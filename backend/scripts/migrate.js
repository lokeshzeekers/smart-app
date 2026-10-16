require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

/**
 * Database migration runner - safe to run on every deploy.
 *
 *  - Fresh, empty database  -> applies db/schema.sql + db/seed.sql, and records every
 *                              file in db/migrations as already applied (schema.sql
 *                              already contains them).
 *  - Existing database      -> applies any db/migrations/NNN_*.sql that is not yet
 *                              recorded in the schema_migrations table, in order.
 *                              The first time this runs on a database that was set up
 *                              by hand, every migration is re-applied once; they are all
 *                              written to be idempotent (IF NOT EXISTS etc.), so that is safe.
 *
 * An advisory lock stops two deploys from migrating at the same time, and the runner
 * waits for the database to accept connections (it starts before Postgres is ready in
 * Docker). Exit code 1 on any failure, so a deploy stops instead of running new code
 * against an old schema.
 *
 * To add a migration: create db/migrations/007_what_it_does.sql (idempotent), AND update
 * db/schema.sql so fresh installs get the same result.
 */

const DB_DIR = path.join(__dirname, '..', 'db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');
const LOCK_ID = 7410231;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry(pool, attempts = 40) {
  for (let i = 1; ; i++) {
    try {
      return await pool.connect();
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`Waiting for the database (${i}/${attempts}): ${err.message}`);
      await sleep(2000);
    }
  }
}

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await connectWithRetry(pool);
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const { rows: appliedRows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.name));
    const record = (name) => client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);

    const { rows } = await client.query(`SELECT to_regclass('public.users') IS NOT NULL AS has_users`);
    if (!rows[0].has_users) {
      console.log('Empty database: applying schema.sql and seed.sql');
      await client.query(fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'));
      await client.query(fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8'));
      for (const f of files) await record(f);
      console.log(`Fresh install ready (${files.length} migrations marked as included).`);
      return;
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('Database is up to date.');
      return;
    }
    for (const f of pending) {
      console.log(`Applying ${f} ...`);
      await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
      await record(f);
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); } catch { /* connection already gone */ }
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
