const path = require('path');
const express = require('express');
const { ensureDb, usingPostgres } = require('./lib/store');
const { getState, handleAction } = require('./lib/actions');
const { getDatabaseUrl, closePool } = require('./lib/db');

async function main() {
  const boot = await ensureDb();
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

  app.get('/api/os', async (req, res) => {
    try {
      res.json(await getState(req.query));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Ошибка чтения данных' });
    }
  });

  app.post('/api/os', async (req, res) => {
    try {
      const result = await handleAction(req.body || {});
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
