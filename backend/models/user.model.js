'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class UserModel extends BaseModel {
  constructor() {
    super('lh_users');
  }

  findByEmail(email) {
    if (!email) return null;
    return db.get(
      'SELECT * FROM lh_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
  }

  findWithEmployee(userId) {
    return db.get(
      `SELECT u.id, u.email, u.role, u.employee_id, e.name, e.dept, e.access, e.emp_id, e.salary, e.phone
       FROM lh_users u
       LEFT JOIN lh_employees e ON u.employee_id = e.id
       WHERE u.id = ?`,
      [userId]
    );
  }
}

module.exports = new UserModel();
