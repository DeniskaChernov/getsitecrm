const { Pool } = require('pg');

let pool = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE_PRIVATE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();
}

function usingPostgres() {
  return Boolean(getDatabaseUrl());
}

function sslConfig() {
  const url = getDatabaseUrl();
  if (!url || process.env.DATABASE_SSL === 'false') return false;
  // Railway private network уже изолирован внутри проекта; TLS там не нужен.
  if (/\.railway\.internal(?::|\/|$)/i.test(url)) return false;
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true') {
    const ca = String(process.env.DATABASE_CA || '').replace(/\\n/g, '\n').trim();
    if (!ca) {
      throw new Error(
        'Для публичного PostgreSQL в production задайте DATABASE_CA или используйте Railway private URL'
      );
    }
    return { ca, rejectUnauthorized: true };
  }
  return undefined;
}

function getPool() {
  if (!usingPostgres()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: sslConfig(),
      max: 10,
    });
    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error', err);
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error('PostgreSQL не настроен (нет DATABASE_URL)');
  return p.query(text, params);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getDatabaseUrl,
  usingPostgres,
  getPool,
  query,
  closePool,
};
