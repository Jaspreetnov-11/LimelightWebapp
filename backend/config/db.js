'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

let sqliteDb = null;
let supabaseClient = null;

// Initialize Supabase if configured
if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  supabaseClient = createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Initialize SQLite
function getSqlite() {
  if (!sqliteDb) {
    const dbDir = path.dirname(env.DATABASE_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    sqliteDb = new DatabaseSync(env.DATABASE_PATH);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA synchronous = NORMAL;');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
  }
  return sqliteDb;
}

// Unified query wrapper for SQLite
const db = {
  getSqlite,
  getSupabase: () => supabaseClient,
  isCloud: () => env.DATABASE_TYPE === 'supabase' && Boolean(supabaseClient),

  all(sql, params = []) {
    const s = getSqlite();
    const stmt = s.prepare(sql);
    return stmt.all(...params);
  },

  get(sql, params = []) {
    const s = getSqlite();
    const stmt = s.prepare(sql);
    return stmt.get(...params);
  },

  run(sql, params = []) {
    const s = getSqlite();
    const stmt = s.prepare(sql);
    return stmt.run(...params);
  },

  exec(sql) {
    const s = getSqlite();
    return s.exec(sql);
  }
};

module.exports = db;
