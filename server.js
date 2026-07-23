const path = require('path');
const express = require('express');
const { ensureDb, readDb, writeDb, usingPostgres, id, str } = require('./lib/store');
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
  ROLES,
} = require('./lib/auth');
const { requiredInProduction } = require('./config/env-vars');

function warnMissingEnv() {
  const missing = [];
  if (process.env.NODE_ENV === 'production') {
    for (const key of requiredInProduction) {
      if (!String(process.env[key] || '').trim()) missing.push(key);
    }
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('[env] SESSION_SECRET не задан — используется dev-секрет. Задайте свой ключ в Railway Variables.');
  }
  if (missing.length) {
    console.warn(`[env] В production не заданы: ${missing.join(', ')}. Заполните Variables в Railway.`);
  }
}

async function resolveUser(req) {
  const session = getSessionUser(req);
  if (!session?.email) return null;
  const data = await readDb();
  return (data.users || []).find((u) => u.email === session.email && u.active !== false) || null;
}

async function main() {
  warnMissingEnv();
  const boot = await ensureDb();
  // Ensure demo users exist with password hashes
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
      res.json({
        ok: true,
        storage: usingPostgres() ? 'postgres' : 'file',
        time: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'health check failed' });
    }
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
      setSessionCookie(res, createSessionToken(user));
      res.json({ ok: true, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const email = str(req.body?.email).trim().toLowerCase();
      const password = str(req.body?.password);
      const displayName = str(req.body?.displayName || req.body?.fullName).trim();
      const requestedRole = str(req.body?.systemRole || 'sales_manager');
      const actor = await resolveUser(req);

      if (!email || !password || !displayName) {
        return res.status(400).json({ error: 'Нужны имя, email и пароль' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль не короче 6 символов' });
      }

      // Open registration only for sales_manager/designer; founder role only by founder
      let systemRole = requestedRole;
      if (!['sales_manager', 'designer', 'founder'].includes(systemRole)) {
        systemRole = 'sales_manager';
      }
      if (systemRole === 'founder' && actor?.systemRole !== 'founder') {
        return res.status(403).json({ error: 'Роль основателя может выдать только учредитель' });
      }
      // If not logged in as founder, new users cannot self-assign founder
      if (!actor && systemRole === 'founder') {
        systemRole = 'sales_manager';
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

      // Auto-login after self-registration
      if (!actor) setSessionCookie(res, createSessionToken(user));
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

      // Designer may only mutate own projects
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
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
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
