'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class PaymentModel extends BaseModel {
  constructor() {
    super('lh_payments');
  }

  async filterPayments({ empId, month, type, limit = 500, offset = 0 } = {}) {
    let sql = `
      SELECT p.*, e.name as emp_name, e.dept as emp_dept, e.emp_id, e.av, e.ini
      FROM lh_payments p
      JOIN lh_employees e ON p.emp = e.id
      WHERE 1=1
    `;
    const params = [];
    if (empId) { sql += ' AND p.emp = ?'; params.push(empId); }
    if (month) { sql += ' AND substr(p.date, 1, 7) = ?'; params.push(month); }
    if (type) { sql += ' AND p.type = ?'; params.push(type); }
    sql += ' ORDER BY p.date DESC, p.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return db.all(sql, params);
  }

  async getTotalPaidForEmployee(empId, month = null) {
    let sql = `
      SELECT COALESCE(SUM(CASE WHEN type = 'Fine' THEN -amount ELSE amount END), 0) as total_paid
      FROM lh_payments WHERE emp = ?
    `;
    const params = [empId];
    if (month) { sql += ' AND substr(date, 1, 7) = ?'; params.push(month); }
    const row = await db.get(sql, params);
    return row ? Number(row.total_paid) || 0 : 0;
  }

  /** Map of employee id -> net paid for a month (one query for payroll runs). */
  async getTotalPaidAll(month) {
    const rows = await db.all(`
      SELECT emp, COALESCE(SUM(CASE WHEN type = 'Fine' THEN -amount ELSE amount END), 0) as total_paid
      FROM lh_payments WHERE substr(date, 1, 7) = ? GROUP BY emp
    `, [month]);
    const map = {};
    for (const r of rows) map[r.emp] = Number(r.total_paid) || 0;
    return map;
  }

  async findByEmp(empId) {
    return this.findAll({ emp: empId }, { orderBy: 'date DESC' });
  }
}

module.exports = new PaymentModel();
