const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Log and keep running - do NOT process.exit() here. This fires for
  // recoverable pool events too (an idle client's connection dropping,
  // a brief Postgres restart/blip), and pg's Pool already discards that
  // client and creates a new one on the next query. Exiting the whole
  // process on every one of these was crashing the backend far more
  // than an actual fatal DB outage would.
  // eslint-disable-next-line no-console
  console.error('PostgreSQL pool error (recovered automatically):', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
