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

function getPool() {
  if (!usingPostgres()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      // Railway private network may use self-signed / internal TLS quirks;
      // public DATABASE_URL usually needs SSL in production.
      ssl: process.env.DATABASE_SSL === 'false'
        ? false
        : process.env.NODE_ENV === 'production' || process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
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
