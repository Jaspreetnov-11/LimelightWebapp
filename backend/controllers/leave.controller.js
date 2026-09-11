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
  const { from_date, to_date, reason = '', emp, remarks = '' } = req.body;
  const kind = req.body.kind === 'wfh' ? 'wfh' : 'leave';
  // Staff can only apply for themselves; admins / team leaders for anyone
  const targetEmpId = (req.user.role === 'admin' || req.user.role === 'manager') && emp ? emp : req.user.id;

  const id = 'l_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const leave = await leaveModel.create({
    id,
    emp: targetEmpId,
    from_date,
    to_date,
    reason,
    kind,
    remarks: String(remarks || '').trim().slice(0, 500),
    status: 'approved'
  });

  const empRecord = await employeeModel.findById(targetEmpId);
  const name = empRecord ? empRecord.name : 'Staff';
  const span = from_date === to_date ? from_date : `${from_date} to ${to_date}`;
  await activityModel.log(`${name} ${kind === 'wfh' ? 'will work from home' : 'applied for leave'} (${span})${reason ? ' · ' + reason : ''}${leave.remarks ? ' · ' + leave.remarks : ''}`);

  return apiResponse.created(res, leave, kind === 'wfh' ? 'Work from home recorded' : 'Leave recorded successfully');
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
