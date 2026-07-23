const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seed = fs.existsSync(SEED_PATH)
      ? JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
      : emptyState();
    writeDb(normalize(seed));
  }
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

function readDb() {
  ensureDb();
  return normalize(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
}

function writeDb(data) {
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
  DB_PATH,
  SEED_PATH,
};
