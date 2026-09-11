'use strict';

const employeeModel = require('../models/employee.model');
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
  const { name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access } = req.body;

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

  return apiResponse.created(res, newEmp, 'Employee added successfully');
});

const updateEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = employeeModel.findById(id);
  if (!existing) {
    throw new AppError('Employee not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.managers && Array.isArray(updateData.managers)) {
    updateData.managers = JSON.stringify(updateData.managers);
  }
  if (updateData.name && !updateData.ini) {
    updateData.ini = updateData.name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  const updated = employeeModel.update(id, updateData);
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
