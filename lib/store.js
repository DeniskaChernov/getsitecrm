const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { usingPostgres, query } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');

function emptyState() {
  return {
    version: 1,
    leads: [],
    qualifications: [],
    activities: [],
    clients: [],
    services: [],
    estimates: [],
    projects: [],
    projectActuals: [],
    projectTasks: [],
    projectHandoffs: [],
    payments: [],
    expenses: [],
    calculations: [],
    scripts: [],
    auditLogs: [],
    users: [],
    settings: {
      hourlyRate: 50000,
      taxRate: 12,
      riskRate: 15,
      fixedMonthly: 30000000,
      plannedProjects: 10,
      targetMargin: 50,
      companyName: 'getsite.uz',
      currency: 'UZS',
    },
    account: {
      registered: true,
      identity: {
        email: 'admin@getsite.uz',
        displayName: 'Денис Марсельевич',
      },
      profile: null,
      onboardingCompleted: true,
    },
    pagination: {
      auditLogs: { total: 0, loaded: 0, hasMore: false },
    },
  };
}

function loadSeed() {
  if (fs.existsSync(SEED_PATH)) {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  }
  return emptyState();
}

function normalize(raw) {
  const base = emptyState();
  const data = { ...base, ...raw };
  for (const key of Object.keys(base)) {
    if (Array.isArray(base[key]) && !Array.isArray(data[key])) data[key] = [];
  }
  data.version = Math.max(1, Number(raw?.version) || Number(data.version) || 1);
  data.settings = { ...base.settings, ...(raw.settings || {}) };
  data.account = { ...base.account, ...(raw.account || {}) };
  data.pagination = {
    auditLogs: {
      total: (data.auditLogs || []).length,
      loaded: (data.auditLogs || []).length,
      hasMore: false,
    },
  };
  return data;
}

async function ensurePostgresSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS os_state (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      payload JSONB NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE os_state
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
  `);

  const existing = await query('SELECT id FROM os_state WHERE id = 1');
  if (existing.rowCount === 0) {
    const seed = normalize(loadSeed());
    await query(
      `INSERT INTO os_state (id, payload, version, updated_at) VALUES (1, $1::jsonb, $2, NOW())`,
      [JSON.stringify(seed), seed.version || 1]
    );
    console.log('PostgreSQL: seeded os_state from data/seed.json');
  }
}

function ensureFileDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    writeFileDb(normalize(loadSeed()));
  }
}

async function ensureDb() {
  if (usingPostgres()) {
    await ensurePostgresSchema();
    return { driver: 'postgres' };
  }
  ensureFileDb();
  return { driver: 'file' };
}

async function pingDb() {
  if (!usingPostgres()) return { ok: true, skipped: true };
  try {
    const result = await query('SELECT 1 AS ok');
    return { ok: result.rowCount === 1, latencyMs: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function readDb() {
  if (usingPostgres()) {
    const result = await query('SELECT payload, version FROM os_state WHERE id = 1');
    if (!result.rowCount) {
      await ensurePostgresSchema();
      const again = await query('SELECT payload, version FROM os_state WHERE id = 1');
      const row = again.rows[0];
      const data = normalize(row.payload);
      data.version = Number(row.version) || data.version || 1;
      return data;
    }
    const data = normalize(result.rows[0].payload);
    data.version = Number(result.rows[0].version) || data.version || 1;
    return data;
  }
  ensureFileDb();
  return normalize(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
}

function writeFileDb(data) {
  const next = normalize(data);
  next.version = (Number(next.version) || 1) + 1;
  next.pagination = {
    auditLogs: {
      total: next.auditLogs.length,
      loaded: next.auditLogs.length,
      hasMore: false,
    },
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function writeDb(data, options = {}) {
  const expectedVersion = options.expectedVersion ?? data.version;
  const next = normalize(data);
  next.pagination = {
    auditLogs: {
      total: next.auditLogs.length,
      loaded: next.auditLogs.length,
      hasMore: false,
    },
  };

  if (usingPostgres()) {
    const newVersion = (Number(expectedVersion) || 1) + 1;
    next.version = newVersion;
    const result = await query(
      `
      UPDATE os_state
      SET payload = $1::jsonb,
          version = $2,
          updated_at = NOW()
      WHERE id = 1 AND version = $3
      `,
      [JSON.stringify(next), newVersion, Number(expectedVersion) || 1]
    );
    if (result.rowCount === 0) {
      // Insert if missing (first write race)
      const exists = await query('SELECT version FROM os_state WHERE id = 1');
      if (!exists.rowCount) {
        await query(
          `INSERT INTO os_state (id, payload, version, updated_at) VALUES (1, $1::jsonb, $2, NOW())`,
          [JSON.stringify(next), newVersion]
        );
        return next;
      }
      const err = new Error('Конфликт версии данных — обновите страницу и повторите');
      err.status = 409;
      throw err;
    }
    return next;
  }

  return writeFileDb(next);
}

function id() {
  return crypto.randomUUID();
}

function todayRu() {
  return new Date().toLocaleDateString('ru-RU');
}

function nowRu() {
  return new Date().toLocaleString('ru-RU');
}

function isoNow() {
  return new Date().toISOString();
}

function audit(data, action, entity, entityId, actor = 'admin@getsite.uz') {
  data.auditLogs = [
    {
      id: id(),
      actor,
      action,
      entity,
      entityId: entityId || '',
      createdAt: isoNow(),
    },
    ...data.auditLogs,
  ];
}

function str(v, fallback = '') {
  if (v == null) return fallback;
  return String(v);
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v) {
  return v === true || v === 'on' || v === 'true' || v === 1 || v === '1';
}

module.exports = {
  ensureDb,
  readDb,
  writeDb,
  pingDb,
  id,
  todayRu,
  nowRu,
  isoNow,
  audit,
  str,
  num,
  bool,
  emptyState,
  normalize,
  usingPostgres,
  DB_PATH,
  SEED_PATH,
};
