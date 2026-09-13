'use strict';
// AI Agent storage: runs (every generation, per staff) and reference files (extracted text).
const db = require('../config/db');
const crypto = require('crypto');

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

const runs = {
  async create({ emp, tool, title, input, output, provider }) {
    const row = { id: id(), emp, tool, title: String(title || '').slice(0, 200), input: JSON.stringify(input || {}), output: JSON.stringify(output || {}), provider: provider || '', created_at: now() };
    await db.run('INSERT INTO lh_ai_runs (id, emp, tool, title, input, output, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [row.id, row.emp, row.tool, row.title, row.input, row.output, row.provider, row.created_at]);
    return row.id;
  },
  /** list without the heavy output column */
  async list({ emp, tool, limit = 50, offset = 0 }) {
    const where = [], vals = [];
    if (emp) { where.push('r.emp = ?'); vals.push(emp); }
    if (tool) { where.push('r.tool = ?'); vals.push(tool); }
    const sql = `SELECT r.id, r.emp, r.tool, r.title, r.provider, r.created_at, e.name AS emp_name FROM lh_ai_runs r LEFT JOIN lh_employees e ON e.id = r.emp ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    return db.all(sql, [...vals, Number(limit), Number(offset)]);
  },
  async get(runId) {
    const r = await db.get('SELECT r.*, e.name AS emp_name FROM lh_ai_runs r LEFT JOIN lh_employees e ON e.id = r.emp WHERE r.id = ?', [runId]);
    if (!r) return null;
    return { ...r, input: parse(r.input, {}), output: parse(r.output, {}) };
  },
  remove: runId => db.run('DELETE FROM lh_ai_runs WHERE id = ?', [runId])
};

const refs = {
  async create({ emp, name, kind, text }) {
    const row = { id: id(), emp, name: String(name || 'reference').slice(0, 200), kind: kind || '', chars: text.length, text, created_at: now() };
    await db.run('INSERT INTO lh_ai_refs (id, emp, name, kind, chars, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [row.id, row.emp, row.name, row.kind, row.chars, row.text, row.created_at]);
    return { id: row.id, name: row.name, kind: row.kind, chars: row.chars, created_at: row.created_at };
  },
  list: emp => db.all('SELECT id, name, kind, chars, created_at FROM lh_ai_refs WHERE emp = ? ORDER BY created_at DESC', [emp]),
  /** full text for a set of ids owned by emp (admins may read any) */
  async texts(ids, emp, isAdmin) {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(',');
    const rows = await db.all(`SELECT id, name, text, emp FROM lh_ai_refs WHERE id IN (${marks})`, ids);
    return rows.filter(r => isAdmin || r.emp === emp);
  },
  async remove(refId, emp, isAdmin) {
    const r = await db.get('SELECT emp FROM lh_ai_refs WHERE id = ?', [refId]);
    if (!r || (!isAdmin && r.emp !== emp)) return false;
    await db.run('DELETE FROM lh_ai_refs WHERE id = ?', [refId]);
    return true;
  }
};

module.exports = { runs, refs };
