'use strict';

const leaveModel = require('../models/leave.model');
const employeeModel = require('../models/employee.model');
const activityModel = require('../models/activity.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const getAllLeaves = catchAsync(async (req, res) => {
  const { empId, month } = req.query;

  let leaves;
  if (empId) {
    leaves = await leaveModel.getEmployeeLeaves(empId, month);
  } else {
    leaves = await leaveModel.findAll({}, { orderBy: 'from_date DESC', limit: 100 });
  }

  return apiResponse.success(res, leaves);
});

const getLeavesToday = catchAsync(async (req, res) => {
  const today = todayISO();
  const onLeave = await leaveModel.getLeavesOnDate(today);
  return apiResponse.success(res, onLeave);
});

const applyLeave = catchAsync(async (req, res) => {
  const { from_date, to_date, reason = '', emp } = req.body;
  const targetEmpId = emp || (req.user ? req.user.employeeId : null);

  if (!targetEmpId) {
    throw new AppError('Employee ID is required to apply for leave.', 400);
  }

  const id = 'l_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const leave = await leaveModel.create({
    id,
    emp: targetEmpId,
    from_date,
    to_date,
    reason,
    status: 'approved'
  });

  const empRecord = await employeeModel.findById(targetEmpId);
  const name = empRecord ? empRecord.name : 'Staff';
  await activityModel.create({
    id: 'act_' + Date.now(),
    text: `${name} applied for leave (${from_date} to ${to_date})`,
    at: new Date().toISOString(),
    read: 0
  });

  return apiResponse.created(res, leave, 'Leave recorded successfully');
});

const deleteLeave = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await leaveModel.findById(id);
  if (!existing) {
    throw new AppError('Leave record not found', 404);
  }

  await leaveModel.delete(id);
  return apiResponse.success(res, null, 'Leave record deleted successfully');
});

module.exports = {
  getAllLeaves,
  getLeavesToday,
  applyLeave,
  deleteLeave
};
