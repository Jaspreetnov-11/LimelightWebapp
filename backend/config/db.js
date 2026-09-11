'use strict';

/**
 * Database adapter (Model layer plumbing).
 *
 * One async API for both engines:
 *   db.all(sql, params)  -> rows[]
 *   db.get(sql, params)  -> row | null
 *   db.run(sql, params)  -> { changes }
 *   db.exec(sql)         -> runs a script
 *   db.columns(table)    -> Set of column names
 *
 * SQL is written in the SQLite dialect with `?` placeholders; the Postgres branch rewrites
 * placeholders to $1..$n. Column types are kept "loose" (TEXT dates, INTEGER booleans) in
 * both schemas so the same queries run unchanged.
 */

const fs = require('fs');
const path = require('path');
const env = require('./env');

let sqliteDb = null;
let pgPool = null;

const isPostgres = env.DATABASE_TYPE === 'postgres';

// ---------------------------------------------------------------- SQLite
function getSqlite() {
  if (!sqliteDb) {
    const { DatabaseSync } = require('node:sqlite');
    const dbDir = path.dirname(env.DATABASE_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    sqliteDb = new DatabaseSync(env.DATABASE_PATH);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA synchronous = NORMAL;');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
  }
  return sqliteDb;
}

// ---------------------------------------------------------------- Postgres
function getPool() {
  if (!pgPool) {
    const { Pool, types } = require('pg');
    // Return numbers, not strings, for NUMERIC / BIGINT (COUNT(*), SUM(...))
    types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));
    types.setTypeParser(20, v => (v === null ? null : parseInt(v, 10)));
    pgPool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: env.IS_VERCEL ? 3 : 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000
    });
    pgPool.on('error', err => console.error('[PG-POOL-ERROR]', err.message));
  }
  return pgPool;
}

function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

// ---------------------------------------------------------------- Unified API
const db = {
  isPostgres,
  initError: null,
  getSqlite,
  getPool,

  async all(sql, params = []) {
    if (isPostgres) {
      const r = await getPool().query(toPgSql(sql), params);
      return r.rows;
    }
    return getSqlite().prepare(sql).all(...params);
  },

  async get(sql, params = []) {
    if (isPostgres) {
      const r = await getPool().query(toPgSql(sql), params);
      return r.rows[0] || null;
    }
    const row = getSqlite().prepare(sql).get(...params);
    return row === undefined ? null : row;
  },

  async run(sql, params = []) {
    if (isPostgres) {
      const r = await getPool().query(toPgSql(sql), params);
      return { changes: r.rowCount };
    }
    const r = getSqlite().prepare(sql).run(...params);
    return { changes: Number(r.changes) || 0 };
  },

  async exec(sql) {
    if (isPostgres) {
      await getPool().query(sql);
      return;
    }
    getSqlite().exec(sql);
  },

  async columns(table) {
    if (isPostgres) {
      const r = await getPool().query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        ['public', table]
      );
      return new Set(r.rows.map(x => x.column_name));
    }
    const info = getSqlite().prepare(`PRAGMA table_info(${table})`).all();
    return new Set(info.map(c => c.name));
  }
};

module.exports = db;
