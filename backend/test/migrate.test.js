// The migration runner, through the real `pg` driver against an in-memory Postgres server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { BACKEND } = require('./helpers');

const PORT = 5455;
let db, server, workdir;

// Run the runner from a scratch copy (PGlite has no pgcrypto, so that line is removed from the copy only)
test.before(async () => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-migrate-'));
  fs.cpSync(path.join(BACKEND, 'scripts'), path.join(workdir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(BACKEND, 'db'), path.join(workdir, 'db'), { recursive: true });
  fs.symlinkSync(path.join(BACKEND, 'node_modules'), path.join(workdir, 'node_modules'));
  const schema = path.join(workdir, 'db/schema.sql');
  fs.writeFileSync(schema, fs.readFileSync(schema, 'utf8').replace(/CREATE EXTENSION[^;]*;/, ''));
  db = new PGlite();
  await db.waitReady;
  server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await server.start();
});
test.after(async () => {
  // Stop the socket server first and let it drain; closing the database underneath a
  // still-draining connection throws asynchronously and makes the file flaky.
  await server.stop();
  await new Promise((r) => setTimeout(r, 300));
  fs.rmSync(workdir, { recursive: true, force: true });
});

const migrate = () =>
  new Promise((resolve) => {
    const c = spawn(process.execPath, ['scripts/migrate.js'], {
      cwd: workdir,
      env: { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable` },
    });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (out += d));
    c.on('exit', (code) => resolve({ code, out }));
  });
const migrationFiles = () => fs.readdirSync(path.join(BACKEND, 'db/migrations')).filter((f) => f.endsWith('.sql')).sort();

test('empty database: schema + seed applied, every migration recorded', async () => {
  const r = await migrate();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Fresh install ready/);
  assert.equal((await db.query('select count(*)::int n from procedure_steps')).rows[0].n, 11);
  const recorded = (await db.query('select name from schema_migrations order by 1')).rows.map((x) => x.name);
  assert.deepEqual(recorded, migrationFiles());
});

test('running again changes nothing', async () => {
  const r = await migrate();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /up to date/);
});

test('an older database gets only the missing migrations, and ends up identical', async () => {
  // Turn the database back into "before 005/006": drop the new columns, swap the step titles back,
  // and forget the two migrations
  await db.exec(`
    ALTER TABLE sessions DROP COLUMN laryngoscope_entered_at, DROP COLUMN intubation_completed_at;
    ALTER TABLE session_step_events DROP COLUMN inferred;
    UPDATE procedure_steps SET title = 'Remove stylet' WHERE step_no = 10;
    UPDATE procedure_steps SET title = 'Insert ETT to 21cm (Female) or 23cm (Male)' WHERE step_no = 11;
    DELETE FROM schema_migrations WHERE name >= '005';`);
  const r = await migrate();
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Applying 005/);
  assert.match(r.out, /Applying 006/);
  assert.doesNotMatch(r.out, /Applying 004/);
  const cols = (await db.query(`select column_name from information_schema.columns
    where (table_name = 'sessions' and column_name = 'laryngoscope_entered_at') or (table_name = 'session_step_events' and column_name = 'inferred')`)).rows;
  assert.equal(cols.length, 2);
  const t = (await db.query('select title from procedure_steps where step_no = 10')).rows[0].title;
  assert.match(t, /^Insert ETT/);
});

test('a failing migration stops with a non-zero exit code', async () => {
  const bad = path.join(workdir, 'db/migrations/999_broken.sql');
  fs.writeFileSync(bad, 'THIS IS NOT SQL;');
  const r = await migrate();
  fs.rmSync(bad);
  assert.equal(r.code, 1);
  assert.match(r.out, /Migration failed/);
});
