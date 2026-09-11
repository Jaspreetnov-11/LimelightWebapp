'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class DepartmentModel extends BaseModel {
  constructor() {
    super('lh_departments');
  }

  async listWithStaffCount() {
    return db.all(`
      SELECT d.*, COUNT(e.id) as staff_count
      FROM lh_departments d
      LEFT JOIN lh_employees e ON d.name = e.dept
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
  }
}

module.exports = new DepartmentModel();
