// Shared test helpers: an in-memory Postgres (PGlite) loaded with the real schema + seed,
// wired in place of the backend's database module. No external database needed.
const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

const BACKEND = path.resolve(__dirname, '..');

async function createDb() {
  const pg = new PGlite();
  // PGlite has no pgcrypto extension; gen_random_uuid() is built into Postgres 13+ anyway.
  const schema = fs.readFileSync(path.join(BACKEND, 'db/schema.sql'), 'utf8').replace(/CREATE EXTENSION[^;]*;/, '');
  await pg.exec(schema);
  await pg.exec(fs.readFileSync(path.join(BACKEND, 'db/seed.sql'), 'utf8'));
  // Replace src/config/db.js before any controller requires it
  require.cache[require.resolve(path.join(BACKEND, 'src/config/db.js'))] = {
    id: 'test-db', filename: 'test-db', loaded: true,
    exports: {
      query: (t, p) => pg.query(t, p),
      getClient: async () => ({ query: (t, p) => pg.query(t, p), release() {} }),
    },
  };
  const q = async (text, params) => (await pg.query(text, params)).rows;
  return { pg, q };
}

/** Minimal Express-like req/res pair for calling controllers directly */
function fakeRes() {
  return {
    code: 200,
    out: undefined,
    status(c) { this.code = c; return this; },
    json(j) { this.out = j; return this; },
    end() { return this; },
  };
}

module.exports = { BACKEND, createDb, fakeRes };
