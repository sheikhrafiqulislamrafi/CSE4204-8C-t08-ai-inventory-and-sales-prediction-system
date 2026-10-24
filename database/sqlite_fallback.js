// SQLite adapter for testing when PostgreSQL is unavailable
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = process.env.SQLITE_DB_FILE || path.join(__dirname, '..', '..', 'analytics_v2.db');
const db = new sqlite3.Database(DB_FILE);

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows, rowCount: rows ? rows.length : 0 });
    });
  });
}

async function query(text, params = []) {
  // Convert PostgreSQL $N placeholders to SQLite ?
  let sqliteText = text.replace(/\$\d+/g, '?');
  return await run(sqliteText, params);
}

async function queryOne(text, params = []) {
  let sqliteText = text.replace(/\$\d+/g, '?');
  return new Promise((resolve, reject) => {
    db.get(sqliteText, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

async function queryAll(text, params = []) {
  let sqliteText = text.replace(/\$\d+/g, '?');
  return new Promise((resolve, reject) => {
    db.all(sqliteText, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = { query, queryOne, queryAll, db };
