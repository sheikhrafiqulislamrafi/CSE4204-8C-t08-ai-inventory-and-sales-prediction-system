
const { Pool } = require('pg');
require('dotenv').config();

// Render/Railway provide a single DATABASE_URL connection string.
// Parse it into host/port/user/password/database so the pool can use it.
function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432', 10),
      user: decodeURIComponent(parsed.username || 'postgres'),
      password: decodeURIComponent(parsed.password || ''),
      database: (parsed.pathname || '').replace(/^\//, '') || 'myshop',
      ssl: parsed.protocol === 'postgres:' && parsed.hostname !== 'localhost'
        ? { rejectUnauthorized: false }
        : undefined,
    };
  } catch {
    return null;
  }
}

const urlConfig = parseDatabaseUrl(process.env.DATABASE_URL);
const poolConfig = urlConfig || {
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'myshop',
};

const pool = new Pool({
  ...poolConfig,
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


function _roundMoney(value) {
  return Math.round((parseFloat(value || 0) + Number.EPSILON) * 100) / 100;
}

function _orderSign(status) {
  return (status || '').trim().toLowerCase() in ['cancelled', 'canceled', 'returned'] ? -1 : 1;
}

function _normalizeText(value) {
  return (value || '').trim().toLowerCase();
}

module.exports = {
  pool,
  query,
  queryOne,
  queryAll,
  _roundMoney,
  _orderSign,
  _normalizeText
};