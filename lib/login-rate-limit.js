const crypto = require('crypto');
const { query, usingPostgres } = require('./db');

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { ip: 30, email: 12 };
const memory = new Map();

function keyHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizedEmail(req) {
  return String(req.body?.email || '').trim().toLowerCase();
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function rateKeys(req) {
  return [
    { scope: 'ip', key: keyHash(clientIp(req)), limit: LIMITS.ip },
    { scope: 'email', key: keyHash(normalizedEmail(req)), limit: LIMITS.email },
  ];
}

async function ensureLoginRateLimitSchema() {
  if (!usingPostgres()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS login_rate_limits (
      scope TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      failures INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scope, key_hash)
    )
  `);
}

function memoryEntry(scope, key) {
  const id = `${scope}:${key}`;
  const now = Date.now();
  let entry = memory.get(id);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { failures: 0, windowStart: now };
    memory.set(id, entry);
  }
  return { id, entry };
}

async function getEntry(scope, key) {
  if (!usingPostgres()) return memoryEntry(scope, key).entry;
  const result = await query(
    `SELECT failures, window_start
       FROM login_rate_limits
      WHERE scope = $1 AND key_hash = $2`,
    [scope, key]
  );
  if (!result.rowCount) return { failures: 0, windowStart: Date.now() };
  return {
    failures: Number(result.rows[0].failures) || 0,
    windowStart: new Date(result.rows[0].window_start).getTime(),
  };
}

async function checkLoginRate(req) {
  const now = Date.now();
  let retryAfter = 0;
  for (const item of rateKeys(req)) {
    const entry = await getEntry(item.scope, item.key);
    const elapsed = now - entry.windowStart;
    if (elapsed < WINDOW_MS && entry.failures >= item.limit) {
      retryAfter = Math.max(retryAfter, Math.ceil((WINDOW_MS - elapsed) / 1000));
    }
  }
  return retryAfter > 0 ? { ok: false, retryAfter } : { ok: true };
}

async function recordLoginFailure(req) {
  for (const item of rateKeys(req)) {
    if (!usingPostgres()) {
      const { entry } = memoryEntry(item.scope, item.key);
      entry.failures += 1;
      continue;
    }
    await query(
      `INSERT INTO login_rate_limits (scope, key_hash, window_start, failures)
       VALUES ($1, $2, NOW(), 1)
       ON CONFLICT (scope, key_hash) DO UPDATE SET
         failures = CASE
           WHEN login_rate_limits.window_start < NOW() - INTERVAL '15 minutes' THEN 1
           ELSE login_rate_limits.failures + 1
         END,
         window_start = CASE
           WHEN login_rate_limits.window_start < NOW() - INTERVAL '15 minutes' THEN NOW()
           ELSE login_rate_limits.window_start
         END`,
      [item.scope, item.key]
    );
  }
}

/** Успешный вход очищает email-блок, но не IP-блок атакующего источника. */
async function clearLoginFailures(req) {
  const email = keyHash(normalizedEmail(req));
  if (!usingPostgres()) {
    memory.delete(`email:${email}`);
    return;
  }
  await query('DELETE FROM login_rate_limits WHERE scope = $1 AND key_hash = $2', [
    'email',
    email,
  ]);
}

module.exports = {
  ensureLoginRateLimitSchema,
  checkLoginRate,
  recordLoginFailure,
  clearLoginFailures,
};
