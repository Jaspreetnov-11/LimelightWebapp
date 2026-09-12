'use strict';

const env = require('../config/env');
const supabase = require('../config/supabase');
const employeeModel = require('../models/employee.model');
const taskModel = require('../models/task.model');
const activityModel = require('../models/activity.model');
const payrollService = require('../services/payroll.service');
const authService = require('../services/auth.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, SHIFTS } = require('../utils/calculations');
const settingsService = require('../services/settings.service');

const ACCESS = ['admin', 'manager', 'staff'];
const cleanWeekOff = v => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map(x => String(x).trim()).filter(x => /^[0-6]$/.test(x)).join(',');
const initialsOf = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
const parseManagers = m => (typeof m === 'string' ? (() => { try { return JSON.parse(m || '[]'); } catch (e) { return []; } })() : (m || []));
const AV = ['o', 'p', 'g', 'r', 'b', 'br', 't'];
const avFor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const cleanShift = s => (SHIFTS[s] ? s : 'day');

const getAllEmployees = catchAsync(async (req, res) => {
  const { query, dept, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const [employees, total, pre] = await Promise.all([
    employeeModel.search({ query, dept, limit, offset }),
    employeeModel.countSearch({ query, dept }),
    payrollService.preloadMonth(thisMonth())
  ]);
  const admin = req.user && req.user.role === 'admin';
  const list = employees.map(e => {
    const pr = payrollService.computeEmployeePayroll(e, thisMonth(), pre);
    const row = { ...e, managers: parseManagers(e.managers), shift: e.shift || 'day' };
    // Pay figures are private: staff only see their own
    if (admin || (req.user && req.user.id === e.id)) Object.assign(row, { pendingBal: pr.pending, earned: pr.earned, paid: pr.paid });
    else { delete row.salary; }
    return row;
  });
  return apiResponse.paginated(res, list, total, page, limit);
});

const getEmployeeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const employee = await employeeModel.findById(id);
  if (!employee) throw new AppError('Employee not found', 404);
  const admin = req.user && (req.user.role === 'admin' || req.user.id === id);
  const [payroll, tasks] = await Promise.all([admin ? payrollService.getEmployeePayroll(employee) : null, taskModel.filterTasks({ assignee: id, limit: 100 })]);
  const out = { ...employee, managers: parseManagers(employee.managers), shift: employee.shift || 'day', tasks };
  if (admin) out.payroll = payroll; else delete out.salary;
  return apiResponse.success(res, out);
});

/**
 * Admin adds staff. The login lives in Supabase Auth: an existing Auth account with this email is
 * linked (password updated only if one was typed), otherwise a new one is created with the given
 * or default password. The employee row uses the Auth user id.
 */
const createEmployee = catchAsync(async (req, res) => {
  const { name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, password, shift } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new AppError('Email is required so the staff member can log in.', 400);
  if (await employeeModel.findByEmail(cleanEmail)) throw new AppError('A staff member with this email already exists.', 409);

  const typedPassword = password && String(password).trim() ? String(password).trim() : '';
  let authUser = await supabase.findUserByEmail(cleanEmail);
  if (authUser) {
    if (typedPassword) await supabase.updateUser(authUser.id, { password: typedPassword, name });
  } else {
    authUser = await supabase.createUser({ email: cleanEmail, password: typedPassword || settingsService.get().defaultPassword || env.DEFAULT_STAFF_PASSWORD, name });
  }
  const id = authUser.id;
  if (await employeeModel.findById(id)) throw new AppError('This login already belongs to a staff member.', 409);

  const newEmp = await employeeModel.create({
    id, name,
    role: role || '',
    dept: dept || 'Operations',
    email: cleanEmail,
    phone: phone || '',
    week_off: cleanWeekOff(req.body.week_off),
    emp_id: emp_id || await employeeModel.nextEmpId(),
    joined: joined || todayISO(),
    dob: dob || null,
    managers: JSON.stringify(Array.isArray(managers) ? managers : []),
    salary: Number(salary) || 0,
    access: settingsService.isAdminEmail(cleanEmail) ? 'admin' : (ACCESS.includes(access) ? access : 'staff'),
    shift: cleanShift(shift),
    av: avFor(id),
    ini: initialsOf(name)
  });

  await activityModel.log(`${name} was added to the team`);
  await activityModel.notify(id, `Welcome to Limelight, ${name.split(' ')[0]}! Your account is ready.`, { kind: 'info', link: '/dashboard' });
  return apiResponse.created(res, { ...newEmp, loginLinked: Boolean(authUser), passwordSet: Boolean(typedPassword) || !authUser }, 'Staff added successfully');
});

const updateEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await employeeModel.findById(id);
  if (!existing) throw new AppError('Employee not found', 404);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== id) throw new AppError('You can only edit your own profile.', 403);

  const updateData = { ...req.body };
  const rawPassword = updateData.password;
  delete updateData.password;
  for (const k of ['pending_bal', 'pendingBal', 'earned', 'paid', 'payroll', 'tasks', 'id', 'loginLinked', 'passwordSet']) delete updateData[k];
  // Only admins change pay, access, shift, employee code or joining date
  if (!isAdmin) for (const k of ['salary', 'access', 'shift', 'emp_id', 'joined', 'active', 'managers', 'dept', 'role', 'week_off']) delete updateData[k];
  if (updateData.week_off !== undefined) updateData.week_off = cleanWeekOff(updateData.week_off);

  if (updateData.managers && Array.isArray(updateData.managers)) updateData.managers = JSON.stringify(updateData.managers);
  if (updateData.email) updateData.email = String(updateData.email).trim().toLowerCase();
  if (updateData.name && !updateData.ini) updateData.ini = initialsOf(updateData.name);
  if (updateData.access !== undefined && !ACCESS.includes(updateData.access)) delete updateData.access;
  if (updateData.email && settingsService.isAdminEmail(updateData.email)) updateData.access = 'admin';
  if (updateData.shift !== undefined) updateData.shift = cleanShift(updateData.shift);

  const updated = await employeeModel.update(id, updateData);

  const authPatch = {};
  if (rawPassword && String(rawPassword).trim()) authPatch.password = String(rawPassword).trim();
  if (updateData.email && updateData.email !== String(existing.email || '').toLowerCase()) authPatch.email = updateData.email;
  if (updateData.name && updateData.name !== existing.name) authPatch.name = updateData.name;
  if (Object.keys(authPatch).length) await supabase.updateUser(id, authPatch);

  return apiResponse.success(res, { ...updated, managers: parseManagers(updated.managers) }, 'Employee updated successfully');
});

const deleteEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (req.user && req.user.id === id) throw new AppError('You cannot remove yourself.', 400);
  const existing = await employeeModel.findById(id);
  if (!existing) throw new AppError('Employee not found', 404);

  await taskModel.unassignEverywhere(id);
  await employeeModel.delete(id);
  try { await supabase.deleteUser(id); } catch (e) { console.error('[AUTH-DELETE]', e.message); }
  await activityModel.log(`${existing.name} was removed from the team`);
  return apiResponse.success(res, null, 'Employee removed successfully');
});

/**
 * Bulk import from a spreadsheet: body { rows: [{name,email,password,phone,designation,department,shift,access,salary,joined,dob,reporting_manager}], dryRun }.
 * Departments that do not exist are created; logins are created or linked. Returns a per-row report.
 */
const importEmployees = catchAsync(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw new AppError('No rows to import', 400);
  if (rows.length > 500) throw new AppError('Import at most 500 rows at a time', 400);
  const result = await require('../services/staff.service').importStaff(rows, { dryRun: Boolean(req.body.dryRun) });
  if (!req.body.dryRun && result.summary.added) await activityModel.log(`${req.user.name} imported ${result.summary.added} staff from a spreadsheet`);
  return apiResponse.success(res, result, req.body.dryRun ? 'Checked' : 'Imported');
});

module.exports = { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee, importEmployees, ACCESS };
