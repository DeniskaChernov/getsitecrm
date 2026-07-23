const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { usingPostgres, query } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');

function emptyState() {
  return {
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const existing = await query('SELECT id FROM os_state WHERE id = 1');
  if (existing.rowCount === 0) {
    const seed = normalize(loadSeed());
    await query(
      `INSERT INTO os_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW())`,
      [JSON.stringify(seed)]
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

async function readDb() {
  if (usingPostgres()) {
    const result = await query('SELECT payload FROM os_state WHERE id = 1');
    if (!result.rowCount) {
      await ensurePostgresSchema();
      const again = await query('SELECT payload FROM os_state WHERE id = 1');
      return normalize(again.rows[0].payload);
    }
    return normalize(result.rows[0].payload);
  }
  ensureFileDb();
  return normalize(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
}

function writeFileDb(data) {
  const next = normalize(data);
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

async function writeDb(data) {
  const next = normalize(data);
  next.pagination = {
    auditLogs: {
      total: next.auditLogs.length,
      loaded: next.auditLogs.length,
      hasMore: false,
    },
  };

  if (usingPostgres()) {
    await query(
      `
      INSERT INTO os_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [JSON.stringify(next)]
    );
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
