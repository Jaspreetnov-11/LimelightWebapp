'use strict';

/**
 * Staff creation shared by "Add staff" and "Import from Excel".
 * Creates / links the Supabase Auth login, creates the department when missing,
 * and inserts the employee row keyed by the Auth user id.
 */

const env = require('../config/env');
const supabase = require('../config/supabase');
const employeeModel = require('../models/employee.model');
const departmentModel = require('../models/department.model');
const settingsService = require('./settings.service');
const AppError = require('../utils/appError');
const { todayISO, SHIFTS } = require('../utils/calculations');

const ACCESS = ['admin', 'manager', 'staff'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const AV = ['o', 'p', 'g', 'r', 'b', 'br', 't'];
const avFor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const initialsOf = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const cleanShift = s => (SHIFTS[s] ? s : Object.keys(SHIFTS)[0] || 'day');
const cleanAccess = a => { const x = clean(a).toLowerCase(); if (x === 'team leader' || x === 'leader' || x === 'tl') return 'manager'; return ACCESS.includes(x) ? x : 'staff'; };
const toDate = v => {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = clean(v);
  if (DATE.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/** Normalise one row (from the form or a spreadsheet) and list its problems. */
function normalizeRow(raw) {
  const r = {
    name: clean(raw.name),
    email: clean(raw.email).toLowerCase(),
    password: String(raw.password == null ? '' : raw.password).trim(),
    phone: clean(raw.phone),
    role: clean(raw.designation || raw.role),
    dept: clean(raw.department || raw.dept),
    shift: clean(raw.shift).toLowerCase(),
    access: cleanAccess(raw.access),
    salary: Math.max(0, Number(String(raw.salary == null ? '' : raw.salary).replace(/[^\d.]/g, '')) || 0),
    joined: toDate(raw.joined),
    dob: toDate(raw.dob),
    manager: clean(raw.reporting_manager || raw.manager),
    emp_id: clean(raw.emp_id)
  };
  const problems = [];
  if (!r.name) problems.push('name missing');
  if (!r.email) problems.push('email missing'); else if (!EMAIL.test(r.email)) problems.push('email invalid');
  if (r.password && r.password.length < 6) problems.push('password under 6 characters');
  if (r.shift && !SHIFTS[r.shift]) problems.push(`shift "${r.shift}" unknown (use ${Object.keys(SHIFTS).join(' / ')})`);
  if (raw.joined && !r.joined) problems.push('joined date unreadable');
  if (raw.dob && !r.dob) problems.push('dob unreadable');
  if (!r.shift) r.shift = cleanShift('');
  if (!r.joined) r.joined = todayISO();
  return { row: r, problems };
}

async function ensureDepartment(name) {
  if (!name) return '';
  const all = await departmentModel.findAll();
  const hit = all.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (hit) return hit.name;
  const created = await departmentModel.create({ id: 'd_' + Math.random().toString(36).slice(2, 8), name, billable: 1, daily: 8, manager: '' });
  return created.name;
}

/**
 * Create one staff member. Returns { employee, passwordSet, linked }.
 * Throws AppError on validation / duplicate / auth problems.
 */
async function addStaff(raw, opts = {}) {
  const { row, problems } = normalizeRow(raw);
  if (problems.length) throw new AppError(problems.join('; '), 400);
  if (await employeeModel.findByEmail(row.email)) throw new AppError('already in staff list', 409);

  const dept = await ensureDepartment(row.dept || 'Operations');
  let authUser = await supabase.findUserByEmail(row.email);
  let linked = false, passwordSet = false;
  if (authUser) {
    linked = true;
    if (row.password) { await supabase.updateUser(authUser.id, { password: row.password, name: row.name }); passwordSet = true; }
  } else {
    authUser = await supabase.createUser({ email: row.email, password: row.password || settingsService.get().defaultPassword || env.DEFAULT_STAFF_PASSWORD, name: row.name });
    passwordSet = Boolean(row.password);
  }
  if (await employeeModel.findById(authUser.id)) throw new AppError('login already belongs to a staff member', 409);

  const employee = await employeeModel.create({
    id: authUser.id,
    name: row.name,
    role: row.role,
    dept,
    email: row.email,
    phone: row.phone,
    emp_id: row.emp_id || await employeeModel.nextEmpId(),
    joined: row.joined,
    dob: row.dob || null,
    managers: JSON.stringify(row.manager ? [row.manager] : []),
    salary: row.salary,
    access: settingsService.isAdminEmail(row.email) ? 'admin' : row.access,
    shift: row.shift,
    av: avFor(authUser.id),
    ini: initialsOf(row.name),
    active: 1
  });
  return { employee, passwordSet, linked, defaultPasswordUsed: !linked && !row.password };
}

/** Import many rows; never throws for a single bad row — returns a per-row report. */
async function importStaff(rows, { dryRun = false } = {}) {
  const report = [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const line = raw._row || i + 2;
    const { row, problems } = normalizeRow(raw);
    if (row.email && seen.has(row.email)) problems.push('duplicate email in file');
    seen.add(row.email);
    if (problems.length) { report.push({ line, name: row.name, email: row.email, status: 'error', message: problems.join('; ') }); continue; }
    if (await employeeModel.findByEmail(row.email)) { report.push({ line, name: row.name, email: row.email, status: 'skipped', message: 'already in staff list' }); continue; }
    if (dryRun) { report.push({ line, name: row.name, email: row.email, status: 'ok', message: row.password ? 'will be added with the given password' : 'will be added with the default password' }); continue; }
    try {
      const r = await addStaff(raw);
      report.push({ line, name: row.name, email: row.email, status: 'added', message: r.linked ? (r.passwordSet ? 'existing login linked, password updated' : 'existing login linked') : (r.defaultPasswordUsed ? 'login created with the default password' : 'login created') });
    } catch (e) {
      report.push({ line, name: row.name, email: row.email, status: 'error', message: e.message });
    }
  }
  const summary = report.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, { added: 0, skipped: 0, error: 0, ok: 0 });
  return { summary, rows: report };
}

module.exports = { addStaff, importStaff, normalizeRow };
