'use strict';

/**
 * Auth service: Supabase Auth is the single login system.
 * The employee record (lh_employees) is keyed by the Supabase Auth user id, so the same
 * id identifies a person everywhere (attendance, tasks, payments, todos).
 * After a successful Supabase sign-in the API issues its own short JWT for the frontend.
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

function isAdminEmail(email) {
  return env.ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

class AuthService {
  generateToken(employee) {
    return jwt.sign(
      { id: employee.id, email: employee.email, role: employee.access || 'staff' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );
  }

  shape(employee) {
    return {
      token: this.generateToken(employee),
      user: { id: employee.id, email: employee.email, role: employee.access || 'staff', employeeId: employee.id },
      employee
    };
  }

  /**
   * Make sure an Auth user has an employee row with the same id.
   * Falls back to the legacy `profiles` table (old app) for name / designation / department.
   */
  async ensureEmployee(authUser, extra = {}) {
    const id = authUser.id;
    const email = String(authUser.email || '').trim().toLowerCase();
    let emp = await employeeModel.findById(id);
    if (emp) {
      if (isAdminEmail(email) && emp.access !== 'admin') emp = await employeeModel.update(id, { access: 'admin' });
      return emp;
    }

    // Employee row created earlier with a non-Auth id but the same email: re-key it to the Auth id.
    const byEmail = await employeeModel.findByEmail(email);
    if (byEmail && byEmail.id !== id) {
      await db.run('UPDATE lh_employees SET id = ?, updated_at = ? WHERE id = ?', [id, new Date().toISOString(), byEmail.id]);
      for (const [table, col] of [['lh_attendance', 'emp'], ['lh_leaves', 'emp'], ['lh_payments', 'emp'], ['lh_todos', 'owner'], ['lh_files', 'assigned_by'], ['lh_tasks', 'assigned_by'], ['lh_projects', 'manager'], ['lh_departments', 'manager']]) {
        await db.run(`UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, [id, byEmail.id]);
      }
      const tasks = await db.all('SELECT id, assignee FROM lh_tasks WHERE assignee LIKE ?', [`%${byEmail.id}%`]);
      for (const t of tasks) {
        const list = String(t.assignee).split(',').map(s => (s.trim() === byEmail.id ? id : s.trim())).filter(Boolean).join(',');
        await db.run('UPDATE lh_tasks SET assignee = ? WHERE id = ?', [list, t.id]);
      }
      return employeeModel.findById(id);
    }

    // Legacy profile (old Supabase app) if present
    let profile = null;
    if (db.isPostgres) {
      try { profile = await db.get('SELECT name, title, dept FROM profiles WHERE id = ?', [id]); } catch (e) { profile = null; }
    }
    const meta = authUser.user_metadata || {};
    const name = extra.name || (profile && profile.name) || meta.name || meta.full_name || email.split('@')[0];

    return employeeModel.create({
      id,
      name,
      role: extra.role || (profile && profile.title) || meta.title || '',
      dept: extra.dept || (profile && profile.dept) || meta.dept || 'Operations',
      email,
      phone: extra.phone || meta.phone || '',
      emp_id: await employeeModel.nextEmpId(),
      joined: extra.joined || todayISO(),
      dob: extra.dob || null,
      managers: '[]',
      salary: Number(extra.salary) || 0,
      access: isAdminEmail(email) ? 'admin' : (extra.access || 'staff'),
      av: avFor(id),
      ini: initialsOf(name)
    });
  }

  async login(email, password) {
    const authUser = await supabase.signIn(email, password);
    const employee = await this.ensureEmployee(authUser);
    if (employee.active !== undefined && Number(employee.active) === 0) {
      throw new AppError('This account is deactivated. Contact an admin.', 403);
    }
    return this.shape(employee);
  }

  async register({ name, email, password, phone = '', company = '' }) {
    const clean = String(email || '').trim().toLowerCase();
    if (await employeeModel.findByEmail(clean)) {
      throw new AppError('An account with this email already exists. Please log in.', 409);
    }

    let authUser;
    if (supabase.admin) {
      authUser = await supabase.createUser({ email: clean, password, name });
    } else if (supabase.anon) {
      const { data, error } = await supabase.anon.auth.signUp({ email: clean, password, options: { data: { name } } });
      if (error) throw new AppError(error.message, 400);
      authUser = data.user;
      if (!authUser) throw new AppError('Sign-up needs email confirmation. Check your inbox, then log in.', 202);
    } else {
      throw new AppError('Supabase Auth is not configured.', 503);
    }

    const employee = await this.ensureEmployee(authUser, {
      name,
      phone,
      role: company ? `${company} Member` : 'Staff'
    });
    await activityModel.log(`${employee.name} registered a new account`);
    return this.shape(employee);
  }
}

module.exports = new AuthService();
