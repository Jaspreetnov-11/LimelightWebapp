'use strict';

const payrollService = require('../services/payroll.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const { thisMonth } = require('../utils/calculations');

const getPayroll = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  const payroll = payrollService.calculateMonthlyPayroll(month);
  return apiResponse.success(res, payroll);
});

const payAllPendingSalaries = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.body;
  const assignedBy = req.user ? (req.user.employeeId || req.user.id) : '';

  const result = payrollService.payAllPending(month, assignedBy);
  return apiResponse.success(res, result, `Recorded salary payments for ${result.count} staff members`);
});

module.exports = {
  getPayroll,
  payAllPendingSalaries
};
