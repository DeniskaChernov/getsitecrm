require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { ensureDb, readDb, writeDb, usingPostgres, id, str, pingDb } = require('./lib/store');
const { getState, handleAction } = require('./lib/actions');
const { getDatabaseUrl, closePool } = require('./lib/db');
const {
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  createSessionToken,
  verifyPassword,
  scryptHash,
  publicUser,
  filterStateForUser,
  canAction,
  defaultUsers,
  normalizeRole,
  validateDisplayName,
  validatePassword,
  ROLES,
} = require('./lib/auth');
const {
  ensureLoginRateLimitSchema,
  checkLoginRate,
  recordLoginFailure,
  clearLoginFailures,
} = require('./lib/login-rate-limit');
const { requiredInProduction, recommendedInProduction } = require('./config/env-vars');

const IS_PROD = process.env.NODE_ENV === 'production';

function assertProductionEnv() {
  if (!IS_PROD) {
    if (!process.env.SESSION_SECRET) {
      console.warn('[env] SESSION_SECRET не задан — используется dev-секрет.');
    }
    return;
  }
  const missing = requiredInProduction.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    console.error(`[env] В production обязательны: ${missing.join(', ')}. Заполните Variables и перезапустите.`);
    process.exit(1);
  }
  const recommended = (recommendedInProduction || []).filter((key) => !String(process.env[key] || '').trim());
  if (recommended.length) {
    console.warn(`[env] Рекомендуется задать: ${recommended.join(', ')} (иначе файловое хранилище).`);
  }
}

async function resolveUser(req) {
  const session = getSessionUser(req);
  if (!session?.email) return null;
  const data = await readDb();
  const user = (data.users || []).find((u) => u.email === session.email && u.active !== false);
  if (!user) return null;
  if ((Number(user.sessionVersion) || 0) !== (Number(session.sessionVersion) || 0)) return null;
  return user;
}

function enforceSameOrigin(req, res, next) {
  if (!req.path.startsWith('/api/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Запрос с другого сайта запрещён' });
  }
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (!requestHost || originHost !== requestHost) {
      return res.status(403).json({ error: 'Источник запроса не разрешён' });
    }
  } catch {
    return res.status(403).json({ error: 'Некорректный Origin' });
  }
  next();
}

async function main() {
  assertProductionEnv();
  const boot = await ensureDb();
  await ensureLoginRateLimitSchema();
  const data = await readDb();
  const defaults = defaultUsers();
  let changed = false;
  for (const u of defaults) {
    const passwordFromEnv = Boolean(u._passwordFromEnv);
    // Не пишем служебные поля в БД
    const clean = {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      passwordHash: u.passwordHash,
      systemRole: u.systemRole,
      position: u.position,
      weeklyCapacity: u.weeklyCapacity,
      active: u.active,
      sessionVersion: Number(u.sessionVersion) || 0,
    };
    // Сначала ищем по id (стабильный ключ), затем по email
    let existing = (data.users || []).find((x) => x.id === clean.id);
    if (!existing) {
      existing = (data.users || []).find((x) => x.email === clean.email);
    }
    if (!existing) {
      data.users = [...(data.users || []), clean];
      changed = true;
      continue;
    }
    if (existing.email !== clean.email) {
      existing.email = clean.email;
      changed = true;
    }
    if (!existing.passwordHash || !String(existing.passwordHash).includes(':')) {
      existing.passwordHash = clean.passwordHash;
      existing.systemRole = existing.systemRole || clean.systemRole;
      existing.displayName = existing.displayName || clean.displayName;
      existing.position = existing.position || clean.position;
      changed = true;
    } else if (passwordFromEnv && !verifyPassword(u._passwordValue, existing.passwordHash)) {
      // Секрет в Railway изменён: обновляем хеш и инвалидируем старые сессии
      existing.passwordHash = clean.passwordHash;
      existing.sessionVersion = (Number(existing.sessionVersion) || 0) + 1;
      changed = true;
    }
  }
  if (!(data.users || []).length) {
    throw new Error(
      'Нет пользователей. Задайте AUTH_*_EMAIL и сильный AUTH_*_PASSWORD (не менее 12 символов).'
    );
  }
  if (changed) await writeDb(data);

  console.log(`Storage driver: ${boot.driver}${usingPostgres() ? ` (${maskUrl(getDatabaseUrl())})` : ''}`);

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Railway завершает TLS на одном доверенном reverse proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      strictTransportSecurity: IS_PROD
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(enforceSameOrigin);

  app.get('/api/health', async (_req, res) => {
    try {
      await ensureDb();
      const dbPing = usingPostgres() ? await pingDb() : { ok: true, skipped: true };
      res.json({
        ok: dbPing.ok !== false,
        storage: usingPostgres() ? 'postgres' : 'file',
        db: dbPing,
        time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Health check failed:', err);
      res.status(500).json({ ok: false, error: 'health check failed' });
    }
  });

  app.get('/api/auth/config', (_req, res) => {
    res.json({
      showDemoAccounts: !IS_PROD,
      registrationOpen: false,
    });
  });

  app.get('/api/auth/me', async (req, res) => {
    try {
      const user = await resolveUser(req);
      if (!user) return res.json({ authenticated: false });
      res.json({
        authenticated: true,
        user: publicUser(user),
        roles: Object.fromEntries(
          Object.entries(ROLES).map(([k, v]) => [k, { label: v.label, sections: v.sections }])
        ),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const rate = await checkLoginRate(req);
      if (!rate.ok) {
        res.setHeader('Retry-After', String(rate.retryAfter || 60));
        return res.status(429).json({
          error: 'Слишком много неудачных попыток входа. Подождите и попробуйте снова.',
          retryAfter: rate.retryAfter || 60,
        });
      }
      const email = str(req.body?.email).trim().toLowerCase();
      const password = str(req.body?.password);
      if (!email || !password) {
        return res.status(400).json({ error: 'Укажите email и пароль' });
      }
      const db = await readDb();
      const user = (db.users || []).find((u) => u.email.toLowerCase() === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        await recordLoginFailure(req);
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }
      if (user.active === false) {
        return res.status(403).json({ error: 'Пользователь отключён' });
      }
      await clearLoginFailures(req);
      setSessionCookie(res, createSessionToken(user), req);
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Invite / create user — founder only (no public self-registration) */
  app.post('/api/auth/register', async (req, res) => {
    try {
      const actor = await resolveUser(req);
      if (!actor || actor.systemRole !== 'founder') {
        return res.status(403).json({ error: 'Создавать пользователей может только основатель' });
      }
      const email = str(req.body?.email).trim().toLowerCase();
      const passwordCheck = validatePassword(req.body?.password);
      const nameCheck = validateDisplayName(req.body?.displayName || req.body?.fullName);
      const systemRole = normalizeRole(req.body?.systemRole || 'sales_manager') || 'sales_manager';

      if (!email || !req.body?.password || !(req.body?.displayName || req.body?.fullName)) {
        return res.status(400).json({ error: 'Нужны имя, email и пароль' });
      }
      if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });
      if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
      if (!ROLES[systemRole]) {
        return res.status(400).json({ error: 'Неизвестная роль' });
      }

      const db = await readDb();
      if ((db.users || []).some((u) => u.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'Пользователь с таким email уже есть' });
      }

      const user = {
        id: id(),
        email,
        displayName: nameCheck.value,
        passwordHash: scryptHash(passwordCheck.value),
        systemRole,
        position: ROLES[systemRole]?.label || 'Пользователь',
        weeklyCapacity: 40,
        active: true,
        sessionVersion: 0,
        createdAt: new Date().toISOString(),
      };
      db.users = [user, ...(db.users || [])];
      await writeDb(db);
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/password', async (req, res) => {
    try {
      const actor = await resolveUser(req);
      if (!actor) return res.status(401).json({ error: 'Требуется вход' });

      const targetEmail = str(req.body?.email || actor.email).trim().toLowerCase();
      const passwordCheck = validatePassword(req.body?.password || req.body?.newPassword);
      const currentPassword = str(req.body?.currentPassword);

      if (!passwordCheck.ok) return res.status(400).json({ error: passwordCheck.error });

      const isSelf = targetEmail === actor.email.toLowerCase();
      if (!isSelf && actor.systemRole !== 'founder') {
        return res.status(403).json({ error: 'Сброс чужого пароля доступен только основателю' });
      }
      if (isSelf && !currentPassword) {
        return res.status(400).json({ error: 'Укажите текущий пароль' });
      }
      if (isSelf && !verifyPassword(currentPassword, actor.passwordHash)) {
        return res.status(401).json({ error: 'Текущий пароль неверный' });
      }

      const db = await readDb();
      const user = (db.users || []).find((u) => u.email.toLowerCase() === targetEmail);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      user.passwordHash = scryptHash(passwordCheck.value);
      user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
      await writeDb(db);
      if (isSelf) clearSessionCookie(res);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/deactivate', async (req, res) => {
    try {
      const actor = await resolveUser(req);
      if (!actor || actor.systemRole !== 'founder') {
        return res.status(403).json({ error: 'Только основатель может отключать пользователей' });
      }
      const email = str(req.body?.email).trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Укажите email' });
      if (email === actor.email.toLowerCase()) {
        return res.status(400).json({ error: 'Нельзя отключить самого себя' });
      }
      const db = await readDb();
      const user = (db.users || []).find((u) => u.email.toLowerCase() === email);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      user.active = false;
      user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
      await writeDb(db);
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const session = getSessionUser(req);
      if (session?.email) {
        const db = await readDb();
        const user = (db.users || []).find((u) => u.email === session.email);
        if (user) {
          user.sessionVersion = (Number(user.sessionVersion) || 0) + 1;
          await writeDb(db);
        }
      }
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (err) {
      clearSessionCookie(res);
      res.status(500).json({ error: 'Не удалось завершить сессию' });
    }
  });

  app.get('/api/os', async (req, res) => {
    try {
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ error: 'Требуется вход' });
      const state = await getState(req.query);
      const filtered = filterStateForUser(state, user);
      res.json(filtered);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Ошибка чтения данных' });
    }
  });

  app.post('/api/os', async (req, res) => {
    try {
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ error: 'Требуется вход' });
      const action = str(req.body?.action);
      if (!canAction(user.systemRole, action)) {
        return res.status(403).json({ error: 'Недостаточно прав для этого действия' });
      }

      if (user.systemRole === 'designer') {
        const db = await readDb();
        const projectScopedActions = new Set([
          'task.create',
          'task.update',
          'task.delete',
          'project.actual',
          'handoff.save',
          'project.update',
        ]);
        const projectId =
          req.body.projectId ||
          db.projects.find((p) => p.id === req.body.id)?.id ||
          db.projectTasks.find((t) => t.id === req.body.id)?.projectId;
        if (projectScopedActions.has(action) && !projectId) {
          return res.status(403).json({ error: 'Не удалось определить доступный проект' });
        }
        if (projectId) {
          const project = db.projects.find((p) => p.id === projectId);
          const { isResponsibleForProject } = require('./lib/auth');
          if (!isResponsibleForProject(user, project, db.projectTasks)) {
            return res.status(403).json({ error: 'Можно менять только свои проекты' });
          }
        }
      }

      const result = await handleAction(req.body || {}, user);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(err.status || 500).json({ error: err.message || 'Ошибка сохранения' });
    }
  });

  app.get('/favicon.svg', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.svg'));
  });

  const fontCache = { maxAge: IS_PROD ? '30d' : 0, immutable: IS_PROD };
  app.use(
    '/assets/fonts/manrope',
    express.static(path.join(__dirname, 'node_modules', '@fontsource-variable', 'manrope'), fontCache)
  );
  app.use(
    '/assets/fonts/bricolage',
    express.static(
      path.join(__dirname, 'node_modules', '@fontsource-variable', 'bricolage-grotesque'),
      fontCache
    )
  );
  app.use(
    '/assets/fonts/ibm-plex-mono',
    express.static(path.join(__dirname, 'node_modules', '@fontsource', 'ibm-plex-mono'), fontCache)
  );

  app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
    maxAge: IS_PROD ? '7d' : 0,
  }));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`GetSite OS listening on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return 'configured';
  }
}

main().catch((err) => {
  console.error('Failed to start GetSite OS', err);
  process.exit(1);
});
