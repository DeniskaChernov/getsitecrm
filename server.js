const path = require('path');
const express = require('express');
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
  ROLES,
} = require('./lib/auth');
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

/** Simple in-memory rate limit for login */
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 20;

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return xf || req.socket?.remoteAddress || 'unknown';
}

function checkLoginRate(req) {
  const key = `${clientIp(req)}:${str(req.body?.email).trim().toLowerCase()}`;
  const now = Date.now();
  let entry = loginAttempts.get(key);
  if (!entry || now - entry.start > LOGIN_WINDOW_MS) {
    entry = { start: now, count: 0 };
    loginAttempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > LOGIN_MAX) {
    const retryAfter = Math.ceil((LOGIN_WINDOW_MS - (now - entry.start)) / 1000);
    return { ok: false, retryAfter };
  }
  return { ok: true };
}

async function resolveUser(req) {
  const session = getSessionUser(req);
  if (!session?.email) return null;
  const data = await readDb();
  return (data.users || []).find((u) => u.email === session.email && u.active !== false) || null;
}

async function main() {
  assertProductionEnv();
  const boot = await ensureDb();
  const data = await readDb();
  const defaults = defaultUsers();
  let changed = false;
  for (const u of defaults) {
    const existing = (data.users || []).find((x) => x.email === u.email);
    if (!existing) {
      data.users = [...(data.users || []), u];
      changed = true;
    } else if (!existing.passwordHash || !String(existing.passwordHash).includes(':')) {
      existing.passwordHash = u.passwordHash;
      existing.systemRole = existing.systemRole || u.systemRole;
      existing.displayName = existing.displayName || u.displayName;
      existing.position = existing.position || u.position;
      changed = true;
    }
  }
  if (changed) await writeDb(data);

  console.log(`Storage driver: ${boot.driver}${usingPostgres() ? ` (${maskUrl(getDatabaseUrl())})` : ''}`);

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '2mb' }));

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
      res.status(500).json({ ok: false, error: err.message || 'health check failed' });
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
      if (!user) return res.status(401).json({ authenticated: false });
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
      const rate = checkLoginRate(req);
      if (!rate.ok) {
        res.setHeader('Retry-After', String(rate.retryAfter || 60));
        return res.status(429).json({ error: 'Слишком много попыток входа. Подождите и попробуйте снова.' });
      }
      const email = str(req.body?.email).trim().toLowerCase();
      const password = str(req.body?.password);
      if (!email || !password) {
        return res.status(400).json({ error: 'Укажите email и пароль' });
      }
      const db = await readDb();
      const user = (db.users || []).find((u) => u.email.toLowerCase() === email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
      }
      if (user.active === false) {
        return res.status(403).json({ error: 'Пользователь отключён' });
      }
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
      const password = str(req.body?.password);
      const displayName = str(req.body?.displayName || req.body?.fullName).trim();
      const systemRole = normalizeRole(req.body?.systemRole || 'sales_manager') || 'sales_manager';

      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Нужны имя, email и пароль' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль не короче 6 символов' });
      }
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
        displayName,
        passwordHash: scryptHash(password),
        systemRole,
        position: ROLES[systemRole]?.label || 'Пользователь',
        weeklyCapacity: 40,
        active: true,
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
      const newPassword = str(req.body?.password || req.body?.newPassword);
      const currentPassword = str(req.body?.currentPassword);

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Новый пароль не короче 6 символов' });
      }

      const isSelf = targetEmail === actor.email.toLowerCase();
      if (!isSelf && actor.systemRole !== 'founder') {
        return res.status(403).json({ error: 'Сброс чужого пароля доступен только основателю' });
      }
      if (isSelf && currentPassword && !verifyPassword(currentPassword, actor.passwordHash)) {
        return res.status(401).json({ error: 'Текущий пароль неверный' });
      }
      if (isSelf && !currentPassword && actor.systemRole !== 'founder') {
        return res.status(400).json({ error: 'Укажите текущий пароль' });
      }

      const db = await readDb();
      const user = (db.users || []).find((u) => u.email.toLowerCase() === targetEmail);
      if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
      user.passwordHash = scryptHash(newPassword);
      await writeDb(db);
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
      await writeDb(db);
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
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
        const projectId =
          req.body.projectId ||
          db.projects.find((p) => p.id === req.body.id)?.id ||
          db.projectTasks.find((t) => t.id === req.body.id)?.projectId;
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
