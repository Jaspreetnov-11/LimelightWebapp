'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const employeeModel = require('../models/employee.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

class AuthService {
  generateToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  async login(email, password) {
    const user = userModel.findByEmail(email);
    if (!user) {
      throw new AppError('Incorrect email or password.', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Incorrect email or password.', 401);
    }

    const employee = user.employee_id ? employeeModel.findById(user.employee_id) : null;
    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id
      },
      employee: employee || {
        id: '',
        name: user.email.split('@')[0],
        email: user.email,
        role: user.role,
        access: user.role
      }
    };
  }

  async register({ name, email, password, phone = '', company = '', role = 'staff' }) {
    const existing = userModel.findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409);
    }

    // Determine initial role (if no other employees exist, first user is admin)
    const empCount = employeeModel.count();
    const accessRole = empCount === 0 ? 'admin' : (role || 'staff');

    // Create employee record
    const empUid = 'e_' + Math.random().toString(36).slice(2, 8);
    const empIdStr = 'LH' + String(empCount + 1).padStart(4, '0');
    const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    const newEmp = employeeModel.create({
      id: empUid,
      name,
      email,
      phone,
      emp_id: empIdStr,
      role: company ? `${company} Member` : 'Staff',
      dept: 'Operations',
      joined: todayISO(),
      dob: null,
      managers: '[]',
      salary: 0,
      access: accessRole,
      av: 'o',
      ini: initials
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user account
    const userUid = 'u_' + Math.random().toString(36).slice(2, 8);
    const newUser = userModel.create({
      id: userUid,
      email,
      password_hash: passwordHash,
      role: accessRole,
      employee_id: newEmp.id
    });

    // Log activity
    activityModel.create({
      id: 'act_' + Date.now(),
      text: `${name} registered a new account`,
      at: new Date().toISOString(),
      read: 0
    });

    const token = this.generateToken(newUser);

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        employeeId: newEmp.id
      },
      employee: newEmp
    };
  }
}

module.exports = new AuthService();
