'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class LeaveModel extends BaseModel {
  constructor() {
    super('lh_leaves');
  }

  async getLeavesOnDate(date) {
    return db.all(`
      SELECT l.*, e.name as emp_name, e.dept as emp_dept, e.av, e.ini
      FROM lh_leaves l
      JOIN lh_employees e ON l.emp = e.id
      WHERE l.from_date <= ? AND l.to_date >= ?
      ORDER BY l.from_date ASC
    `, [date, date]);
  }

  async getEmployeeLeaves(empId, month = null) {
    let sql = 'SELECT * FROM lh_leaves WHERE emp = ?';
    const params = [empId];
    if (month) {
      sql += ' AND (substr(from_date, 1, 7) = ? OR substr(to_date, 1, 7) = ?)';
      params.push(month, month);
    }
    sql += ' ORDER BY from_date DESC';
    return db.all(sql, params);
  }

  /** Every leave touching a month, for all employees. */
  async getLeavesInMonthAll(month) {
    return db.all(
      'SELECT * FROM lh_leaves WHERE substr(from_date, 1, 7) = ? OR substr(to_date, 1, 7) = ? ORDER BY from_date DESC',
      [month, month]
    );
  }
}

module.exports = new LeaveModel();
