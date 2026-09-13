'use strict';
// AI Agent storage: runs (every generation, per staff) and reference files (extracted text).
// Large text columns are gzip-compressed before they hit the database (prefix "gz:" + base64),
// which cuts storage 3-5x; readers get plain values back.
const db = require('../config/db');
const crypto = require('crypto');
const zlib = require('zlib');

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function pack(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value || {});
  if (s.length < 512) return s;
  return 'gz:' + zlib.gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).toString('base64');
}
function unpack(s, asJson) {
  let text = s == null ? '' : String(s);
  if (text.startsWith('gz:')) { try { text = zlib.gunzipSync(Buffer.from(text.slice(3), 'base64')).toString('utf8'); } catch (e) { text = ''; } }
  if (!asJson) return text;
  try { return JSON.parse(text); } catch (e) { return {}; }
}

const runs = {
  async create({ emp, tool, title, input, output, provider }) {
    const row = { id: id(), emp, tool, title: String(title || '').slice(0, 200), input: pack(input), output: pack(output), provider: provider || '', created_at: now() };
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
    return { ...r, input: unpack(r.input, true), output: unpack(r.output, true) };
  },
  /** merge fields into the stored output (used for the schedule's posted ticks) */
  async patchOutput(runId, patch) {
    const r = await db.get('SELECT output FROM lh_ai_runs WHERE id = ?', [runId]);
    if (!r) return null;
    const output = { ...unpack(r.output, true), ...patch };
    await db.run('UPDATE lh_ai_runs SET output = ? WHERE id = ?', [pack(output), runId]);
    return output;
  },
  remove: runId => db.run('DELETE FROM lh_ai_runs WHERE id = ?', [runId])
};

const refs = {
  async create({ emp, name, kind, text }) {
    const hash = sha(text);
    const dup = await db.get('SELECT id, name, kind, chars, created_at FROM lh_ai_refs WHERE emp = ? AND hash = ?', [emp, hash]);
    if (dup) return { ...dup, duplicate: true };
    const row = { id: id(), emp, name: String(name || 'reference').slice(0, 200), kind: kind || '', chars: text.length, text: pack(text), hash, created_at: now() };
    await db.run('INSERT INTO lh_ai_refs (id, emp, name, kind, chars, text, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [row.id, row.emp, row.name, row.kind, row.chars, row.text, row.hash, row.created_at]);
    return { id: row.id, name: row.name, kind: row.kind, chars: row.chars, created_at: row.created_at, stored: row.text.length };
  },
  list: emp => db.all('SELECT id, name, kind, chars, created_at FROM lh_ai_refs WHERE emp = ? ORDER BY created_at DESC', [emp]),
  /** full text for a set of ids owned by emp (admins may read any) */
  async texts(ids, emp, isAdmin) {
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(',');
    const rows = await db.all(`SELECT id, name, text, emp FROM lh_ai_refs WHERE id IN (${marks})`, ids);
    return rows.filter(r => isAdmin || r.emp === emp).map(r => ({ ...r, text: unpack(r.text, false) }));
  },
  async remove(refId, emp, isAdmin) {
    const r = await db.get('SELECT emp FROM lh_ai_refs WHERE id = ?', [refId]);
    if (!r || (!isAdmin && r.emp !== emp)) return false;
    await db.run('DELETE FROM lh_ai_refs WHERE id = ?', [refId]);
    return true;
  }
};

module.exports = { runs, refs, pack, unpack };
