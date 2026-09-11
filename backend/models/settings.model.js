'use strict';

const db = require('../config/db');

/** Key / JSON-value store for workspace settings. */
class SettingsModel {
  async getAll() {
    const rows = await db.all('SELECT key, value FROM lh_settings');
    const out = {};
    for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; } }
    return out;
  }

  async set(key, value) {
    const v = JSON.stringify(value);
    const now = new Date().toISOString();
    const existing = await db.get('SELECT key FROM lh_settings WHERE key = ?', [key]);
    if (existing) await db.run('UPDATE lh_settings SET value = ?, updated_at = ? WHERE key = ?', [v, now, key]);
    else await db.run('INSERT INTO lh_settings (key, value, updated_at) VALUES (?, ?, ?)', [key, v, now]);
  }
}

module.exports = new SettingsModel();
