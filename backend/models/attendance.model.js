'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class AttendanceModel extends BaseModel {
  constructor() {
    super('lh_attendance');
  }

  findByEmpAndDate(empId, date) {
    return db.get(
      'SELECT * FROM lh_attendance WHERE emp = ? AND date = ?',
      [empId, date]
    );
  }

  listDayAttendance(date) {
    return db.all(`
      SELECT a.*, e.name as emp_name, e.dept as emp_dept, e.emp_id, e.av, e.ini
      FROM lh_attendance a
      JOIN lh_employees e ON a.emp = e.id
      WHERE a.date = ?
      ORDER BY e.name ASC
    `, [date]);
  }

  getMonthAttendance(empId, month) {
    return db.all(`
      SELECT * FROM lh_attendance
      WHERE emp = ? AND substr(date, 1, 7) = ?
      ORDER BY date ASC
    `, [empId, month]);
  }

  upsertPunch(data) {
    const existing = this.findByEmpAndDate(data.emp, data.date);
    if (existing) {
      return this.update(existing.id, data);
    }
    return this.create(data);
  }
}

module.exports = new AttendanceModel();
