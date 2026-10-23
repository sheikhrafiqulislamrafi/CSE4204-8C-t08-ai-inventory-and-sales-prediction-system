
const { Pool } = require('pg');
require('dotenv').config();

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