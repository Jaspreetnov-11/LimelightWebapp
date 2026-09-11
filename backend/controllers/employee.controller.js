'use strict';

const env = require('../config/env');
const supabase = require('../config/supabase');
const employeeModel = require('../models/employee.model');
const taskModel = require('../models/task.model');
const activityModel = require('../models/activity.model');
const payrollService = require('../services/payroll.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO, thisMonth } = require('../utils/calculations');

const initialsOf = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
const parseManagers = m => (typeof m === 'string' ? (() => { try { return JSON.parse(m || '[]'); } catch (e) { return []; } })() : (m || []));
const AV = ['o', 'p', 'g', 'r', 'b', 'br', 't'];
const avFor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

const getAllEmployees = catchAsync(async (req, res) => {
  const { query, dept, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const [employees, total, pre] = await Promise.all([
    employeeModel.search({ query, dept, limit, offset }),
    employeeModel.countSearch({ query, dept }),
    payrollService.preloadMonth(thisMonth())
  ]);

  const list = employees.map(e => {
    const pr = payrollService.computeEmployeePayroll(e, thisMonth(), pre);
    return { ...e, managers: parseManagers(e.managers), pendingBal: pr.pending, earned: pr.earned, paid: pr.paid };
  });

  return apiResponse.paginated(res, list, total, page, limit);
});

const getEmployeeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const employee = await employeeModel.findById(id);
  if (!employee) throw new AppError('Employee not found', 404);

  const [payroll, tasks] = await Promise.all([
    payrollService.getEmployeePayroll(employee),
    taskModel.filterTasks({ assignee: id, limit: 100 })
  ]);

  return apiResponse.success(res, { ...employee, managers: parseManagers(employee.managers), payroll, tasks });
});

/**
 * Admin adds staff: a Supabase Auth login is created with the given (or default) password,
 * and the employee row uses the Auth user id.
 */
const createEmployee = catchAsync(async (req, res) => {
  const { name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, password } = req.body;
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new AppError('Email is required so the staff member can log in.', 400);

  if (await employeeModel.findByEmail(cleanEmail)) {
    throw new AppError('A staff member with this email already exists.', 409);
  }

  const pass = (password && String(password).trim()) ? String(password).trim() : env.DEFAULT_STAFF_PASSWORD;
  const authUser = await supabase.createUser({ email: cleanEmail, password: pass, name });
  const id = authUser.id;

  const existingById = await employeeModel.findById(id);
  if (existingById) throw new AppError('This login already belongs to a staff member.', 409);

  const newEmp = await employeeModel.create({
    id,
    name,
    role: role || '',
    dept: dept || 'Operations',
    email: cleanEmail,
    phone: phone || '',
    emp_id: emp_id || await employeeModel.nextEmpId(),
    joined: joined || todayISO(),
    dob: dob || null,
    managers: JSON.stringify(Array.isArray(managers) ? managers : []),
    salary: Number(salary) || 0,
    access: env.ADMIN_EMAILS.includes(cleanEmail) ? 'admin' : (access || 'staff'),
    av: avFor(id),
    ini: initialsOf(name)
  });

  await activityModel.log(`${name} was added to the team`);
  return apiResponse.created(res, newEmp, 'Employee added successfully');
});

const updateEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await employeeModel.findById(id);
  if (!existing) throw new AppError('Employee not found', 404);

  const updateData = { ...req.body };
  const rawPassword = updateData.password;
  delete updateData.password;
  for (const k of ['pending_bal', 'pendingBal', 'earned', 'paid', 'payroll', 'tasks', 'id']) delete updateData[k];

  if (updateData.managers && Array.isArray(updateData.managers)) updateData.managers = JSON.stringify(updateData.managers);
  if (updateData.email) updateData.email = String(updateData.email).trim().toLowerCase();
  if (updateData.name && !updateData.ini) updateData.ini = initialsOf(updateData.name);
  if (updateData.email && env.ADMIN_EMAILS.includes(updateData.email)) updateData.access = 'admin';

  // Only admins may change access level
  if (updateData.access !== undefined && req.user.role !== 'admin') delete updateData.access;

  const updated = await employeeModel.update(id, updateData);

  // Keep the Supabase Auth account in sync (email / password / display name)
  const authPatch = {};
  if (rawPassword && String(rawPassword).trim()) authPatch.password = String(rawPassword).trim();
  if (updateData.email && updateData.email !== String(existing.email || '').toLowerCase()) authPatch.email = updateData.email;
  if (updateData.name && updateData.name !== existing.name) authPatch.name = updateData.name;
  if (Object.keys(authPatch).length) {
    if (authPatch.password && req.user.role !== 'admin' && req.user.id !== id) {
      throw new AppError('Only admins can change another user\'s password.', 403);
    }
    await supabase.updateUser(id, authPatch);
  }

  return apiResponse.success(res, updated, 'Employee updated successfully');
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

module.exports = { getAllEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee };
