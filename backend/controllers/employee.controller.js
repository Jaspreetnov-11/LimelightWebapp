'use strict';

const bcrypt = require('bcryptjs');
const employeeModel = require('../models/employee.model');
const userModel = require('../models/user.model');
const taskModel = require('../models/task.model');
const payrollService = require('../services/payroll.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const getAllEmployees = catchAsync(async (req, res) => {
  const { query, dept, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const employees = employeeModel.search({ query, dept, limit, offset });
  const total = employeeModel.countSearch({ query, dept });

  // Augment each employee with their calculated pending balance
  const list = employees.map(e => {
    const pr = payrollService.getEmployeePayroll(e);
    return {
      ...e,
      managers: typeof e.managers === 'string' ? JSON.parse(e.managers || '[]') : e.managers,
      pendingBal: pr.pending,
      earned: pr.earned,
      paid: pr.paid
    };
  });

  return apiResponse.paginated(res, list, total, page, limit);
});

const getEmployeeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const employee = employeeModel.findById(id);
  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  const payroll = payrollService.getEmployeePayroll(employee);
  const tasks = taskModel.filterTasks({ assignee: id, limit: 100 });

  return apiResponse.success(res, {
    ...employee,
    managers: typeof employee.managers === 'string' ? JSON.parse(employee.managers || '[]') : employee.managers,
    payroll,
    tasks
  });
});

const createEmployee = catchAsync(async (req, res) => {
  const { name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, password } = req.body;

  const count = employeeModel.count();
  const id = 'e_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const empIdVal = emp_id || ('LH' + String(count + 1).padStart(4, '0'));
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');

  const newEmp = employeeModel.create({
    id,
    name,
    role: role || '',
    dept: dept || 'Operations',
    email: email || '',
    phone: phone || '',
    emp_id: empIdVal,
    joined: joined || todayISO(),
    dob: dob || null,
    managers: JSON.stringify(Array.isArray(managers) ? managers : []),
    salary: Number(salary) || 0,
    access: access || 'staff',
    av: 'o',
    ini: initials
  });

  // If email is provided, create/update login account in lh_users
  if (email && email.trim()) {
    const userEmail = email.trim().toLowerCase();
    const existingUser = userModel.findByEmployeeId(newEmp.id) || userModel.findByEmail(userEmail);
    const pass = (password && password.trim()) ? password.trim() : 'Lighthouse@123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(pass, salt);

    if (!existingUser) {
      userModel.create({
        id: 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
        email: userEmail,
        password_hash: passwordHash,
        role: access || 'staff',
        employee_id: newEmp.id
      });
    } else {
      userModel.update(existingUser.id, {
        email: userEmail,
        password_hash: passwordHash,
        role: access || existingUser.role,
        employee_id: newEmp.id
      });
    }
  }

  return apiResponse.created(res, newEmp, 'Employee added successfully');
});

const updateEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = employeeModel.findById(id);
  if (!existing) {
    throw new AppError('Employee not found', 404);
  }

  const updateData = { ...req.body };
  const rawPassword = updateData.password;
  delete updateData.password; // Do not attempt to update non-existent column in lh_employees

  // Strip computed/virtual fields that frontend may attach
  delete updateData.pending_bal;
  delete updateData.pendingBal;
  delete updateData.earned;
  delete updateData.paid;
  delete updateData.payroll;
  delete updateData.tasks;

  if (updateData.managers && Array.isArray(updateData.managers)) {
    updateData.managers = JSON.stringify(updateData.managers);
  }
  if (updateData.name && !updateData.ini) {
    updateData.ini = updateData.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  const updated = employeeModel.update(id, updateData);

  // Sync user credentials in lh_users
  const targetEmail = (updateData.email || existing.email || '').trim().toLowerCase();
  const targetRole = updateData.access || existing.access || 'staff';

  // Find linked user: 1st by employee_id, 2nd by new email, 3rd by old email
  let linkedUser = userModel.findByEmployeeId(id);
  if (!linkedUser && targetEmail) {
    linkedUser = userModel.findByEmail(targetEmail);
  }
  if (!linkedUser && existing.email) {
    linkedUser = userModel.findByEmail(existing.email.trim().toLowerCase());
  }

  if (rawPassword && rawPassword.trim()) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword.trim(), salt);
    if (linkedUser) {
      userModel.update(linkedUser.id, {
        email: targetEmail || linkedUser.email,
        password_hash: passwordHash,
        role: targetRole,
        employee_id: id
      });
    } else if (targetEmail) {
      userModel.create({
        id: 'u_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
        email: targetEmail,
        password_hash: passwordHash,
        role: targetRole,
        employee_id: id
      });
    }
  } else if (linkedUser && targetEmail && (linkedUser.email !== targetEmail || linkedUser.role !== targetRole)) {
    userModel.update(linkedUser.id, {
      email: targetEmail,
      role: targetRole,
      employee_id: id
    });
  }

  return apiResponse.success(res, updated, 'Employee updated successfully');
});

const deleteEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (req.user && req.user.employeeId === id) {
    throw new AppError('You cannot remove yourself.', 400);
  }

  const existing = employeeModel.findById(id);
  if (!existing) {
    throw new AppError('Employee not found', 404);
  }

  // Unassign tasks assigned to this employee
  const s = require('../config/db').getSqlite();
  s.prepare("UPDATE lh_tasks SET assignee = '' WHERE assignee = ?").run(id);

  employeeModel.delete(id);
  return apiResponse.success(res, null, 'Employee removed successfully');
});

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
