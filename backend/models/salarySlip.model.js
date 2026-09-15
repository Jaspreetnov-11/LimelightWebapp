'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class SalarySlipModel extends BaseModel {
  constructor() {
    super('lh_salary_slips');
  }

  async findByEmpAndMonth(empId, month) {
    return this.findOne({ emp: empId, month });
  }

  async findByEmpAndYear(empId, year) {
    const sql = `SELECT * FROM lh_salary_slips WHERE emp = ? AND year = ? ORDER BY month ASC`;
    return db.all(sql, [empId, year]);
  }

  async findAllByEmp(empId) {
    const sql = `SELECT * FROM lh_salary_slips WHERE emp = ? ORDER BY month DESC`;
    return db.all(sql, [empId]);
  }

  async upsert(data) {
    const existing = await this.findByEmpAndMonth(data.emp, data.month);
    const now = new Date().toISOString();
    if (existing) {
      return this.update(existing.id, {
        ...data,
        updated_at: now
      });
    }
    const id = data.id || `slip_${data.emp}_${data.month.replace('-', '')}`;
    return this.create({
      id,
      ...data,
      created_at: now,
      updated_at: now
    });
  }
}

module.exports = new SalarySlipModel();
