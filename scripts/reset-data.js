const fs = require('fs');
const path = require('path');
const { usingPostgres, query, closePool } = require('../lib/db');
const { normalize, SEED_PATH, DB_PATH } = require('../lib/store');

async function main() {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const payload = normalize(seed);

  if (usingPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS os_state (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(
      `
      INSERT INTO os_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload,
          updated_at = NOW()
      `,
      [JSON.stringify(payload)]
    );
    console.log('PostgreSQL os_state reset from seed.json');
    await closePool();
    return;
  }

  fs.copyFileSync(SEED_PATH, DB_PATH);
  console.log('data/db.json restored from seed.json');
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => {});
  process.exit(1);
});
