'use strict';

/**
 * Auth service: Supabase Auth is the single login system.
 * The employee record (lh_employees) is keyed by the Supabase Auth user id, so the same
 * id identifies a person everywhere (attendance, tasks, payments, todos).
 * Staff are added by an admin (Staff -> Add staff); logging in with an Auth account that has
 * no employee record is refused, except for the configured admin emails which are set up
 * automatically on first login.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const supabase = require('../config/supabase');
const db = require('../config/db');
const employeeModel = require('../models/employee.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const initialsOf = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || 'LM';
const AV = ['o', 'p', 'g', 'r', 'b', 'br', 't'];
const avFor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const isAdminEmail = email => require('./settings.service').isAdminEmail(email);

class AuthService {
  generateToken(employee) {
    return jwt.sign({ id: employee.id, email: employee.email, role: employee.access || 'staff' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
  }

  shape(employee) {
    return {
      token: this.generateToken(employee),
      user: { id: employee.id, email: employee.email, role: employee.access || 'staff', employeeId: employee.id },
      employee
    };
  }

  /** Re-key an employee row (and everything that references it) to a new id. */
  async rekeyEmployee(oldId, newId) {
    const now = new Date().toISOString();
    await db.run('UPDATE lh_employees SET id = ?, updated_at = ? WHERE id = ?', [newId, now, oldId]);
    for (const [table, col] of [['lh_attendance', 'emp'], ['lh_leaves', 'emp'], ['lh_payments', 'emp'], ['lh_todos', 'owner'], ['lh_files', 'assigned_by'], ['lh_tasks', 'assigned_by'], ['lh_projects', 'manager'], ['lh_departments', 'manager'], ['lh_activity', 'user_id']]) {
      await db.run(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, [newId, oldId]);
    }
    const tasks = await db.all('SELECT id, assignee FROM lh_tasks WHERE assignee LIKE ?', [`%${oldId}%`]);
    for (const t of tasks) {
      const list = String(t.assignee).split(',').map(s => (s.trim() === oldId ? newId : s.trim())).filter(Boolean).join(',');
      await db.run('UPDATE lh_tasks SET assignee = ? WHERE id = ?', [list, t.id]);
    }
  }

  /** Employee row for an Auth user: existing by id, re-keyed by email, or (admins only) created. */
  async resolveEmployee(authUser, extra = {}) {
    const id = authUser.id;
    const email = String(authUser.email || '').trim().toLowerCase();
    let emp = await employeeModel.findById(id);
    if (!emp) {
      const byEmail = await employeeModel.findByEmail(email);
      if (byEmail) { await this.rekeyEmployee(byEmail.id, id); emp = await employeeModel.findById(id); }
    }
    if (emp) {
      if (isAdminEmail(email) && emp.access !== 'admin') emp = await employeeModel.update(id, { access: 'admin' });
      return emp;
    }
    if (!isAdminEmail(email) && !extra.create) return null;

    const meta = authUser.user_metadata || {};
    const name = extra.name || meta.name || meta.full_name || email.split('@')[0];
    return employeeModel.create({
      id, name, email,
      role: extra.role || meta.title || (isAdminEmail(email) ? 'Administrator' : ''),
      dept: extra.dept || meta.dept || 'Operations',
      phone: extra.phone || meta.phone || '',
      emp_id: await employeeModel.nextEmpId(),
      joined: extra.joined || todayISO(),
      dob: extra.dob || null,
      managers: '[]',
      salary: Number(extra.salary) || 0,
      access: isAdminEmail(email) ? 'admin' : (extra.access || 'staff'),
      shift: extra.shift || 'day',
      av: avFor(id),
      ini: initialsOf(name)
    });
  }

  async login(email, password) {
    const authUser = await supabase.signIn(email, password);
    const employee = await this.resolveEmployee(authUser);
    if (!employee) throw new AppError('Your account is not set up in Limelight yet. Ask your admin to add you under Staff.', 403);
    if (employee.active !== undefined && employee.active !== null && Number(employee.active) === 0) {
      throw new AppError('This account is deactivated. Contact an admin.', 403);
    }
    return this.shape(employee);
  }

  /** Self sign-up is only for the admin emails; everyone else is added by an admin. */
  async register({ name, email, password, phone = '' }) {
    const clean = String(email || '').trim().toLowerCase();
    if (!isAdminEmail(clean)) throw new AppError('Staff accounts are created by your admin under Staff → Add staff. Ask them to add you, then log in here.', 403);
    if (await employeeModel.findByEmail(clean)) throw new AppError('An account with this email already exists. Please log in.', 409);

    const authUser = await supabase.createUser({ email: clean, password, name });
    const employee = await this.resolveEmployee(authUser, { name, phone, create: true });
    await activityModel.log(`${employee.name} registered the admin account`);
    return this.shape(employee);
  }
}

module.exports = new AuthService();
