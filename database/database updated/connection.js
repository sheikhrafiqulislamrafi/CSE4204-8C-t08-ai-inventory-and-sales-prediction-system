// Database connection - PostgreSQL via pg (raw SQL, no ORM)
// Note: PostgreSQL must be installed and running for this to work.
// If PostgreSQL is unavailable, install it via: https://www.postgresql.org/download/
require('dotenv').config();
const { Pool } = require('pg');

const path = require('path');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'myshop',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function queryOne(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

async function queryAll(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

module.exports = { pool, query, queryOne, queryAll };
