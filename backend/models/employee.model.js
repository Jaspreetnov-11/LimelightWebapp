'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

function searchWhere({ query = '', dept = '' } = {}) {
  let sql = '';
  const params = [];
  if (query) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(emp_id) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?)';
    const q = `%${String(query).toLowerCase()}%`;
    params.push(q, q, q, q);
  }
  if (dept) {
    sql += ' AND dept = ?';
    params.push(dept);
  }
  return { sql, params };
}

class EmployeeModel extends BaseModel {
  constructor() {
    super('lh_employees');
  }

  async search({ query = '', dept = '', limit = 100, offset = 0 } = {}) {
    const w = searchWhere({ query, dept });
    const sql = `SELECT * FROM lh_employees WHERE 1=1${w.sql} ORDER BY name ASC LIMIT ? OFFSET ?`;
    return db.all(sql, [...w.params, Number(limit), Number(offset)]);
  }

  async countSearch({ query = '', dept = '' } = {}) {
    const w = searchWhere({ query, dept });
    const row = await db.get(`SELECT COUNT(*) as total FROM lh_employees WHERE 1=1${w.sql}`, w.params);
    return row ? Number(row.total) || 0 : 0;
  }

  async findByEmail(email) {
    if (!email) return null;
    return db.get('SELECT * FROM lh_employees WHERE LOWER(email) = LOWER(?) LIMIT 1', [String(email).trim()]);
  }

  /** Next sequential employee code, e.g. LH0020 */
  async nextEmpId() {
    const rows = await db.all("SELECT emp_id FROM lh_employees WHERE emp_id LIKE 'LH%'");
    let max = 0;
    for (const r of rows) {
      const n = parseInt(String(r.emp_id).slice(2), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return 'LH' + String(max + 1).padStart(4, '0');
  }
}

module.exports = new EmployeeModel();
