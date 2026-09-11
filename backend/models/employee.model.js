'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class EmployeeModel extends BaseModel {
  constructor() {
    super('lh_employees');
  }

  search({ query = '', dept = '', limit = 100, offset = 0 } = {}) {
    let sql = 'SELECT * FROM lh_employees WHERE 1=1';
    const params = [];

    if (query) {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(emp_id) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?)`;
      const q = `%${query.toLowerCase()}%`;
      params.push(q, q, q, q);
    }

    if (dept) {
      sql += ` AND dept = ?`;
      params.push(dept);
    }

    sql += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    return db.all(sql, params);
  }

  findByEmail(email) {
    if (!email) return null;
    return db.get(
      'SELECT * FROM lh_employees WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
  }

  countSearch({ query = '', dept = '' } = {}) {
    let sql = 'SELECT COUNT(*) as total FROM lh_employees WHERE 1=1';
    const params = [];

    if (query) {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(emp_id) LIKE ? OR phone LIKE ? OR LOWER(email) LIKE ?)`;
      const q = `%${query.toLowerCase()}%`;
      params.push(q, q, q, q);
    }

    if (dept) {
      sql += ` AND dept = ?`;
      params.push(dept);
    }

    const row = db.get(sql, params);
    return row ? row.total : 0;
  }
}

module.exports = new EmployeeModel();
