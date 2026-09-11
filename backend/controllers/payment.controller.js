'use strict';

const paymentModel = require('../models/payment.model');
const employeeModel = require('../models/employee.model');
const activityModel = require('../models/activity.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, formatINR } = require('../utils/calculations');

const getAllPayments = catchAsync(async (req, res) => {
  const { empId, month = thisMonth(), type, page = 1, limit = 200 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const payments = await paymentModel.filterPayments({ empId, month, type, limit, offset });
  const total = await paymentModel.count();

  return apiResponse.paginated(res, payments, total, page, limit);
});

const createPayment = catchAsync(async (req, res) => {
  const { emp, date = todayISO(), amount, type = 'Salary', note = '' } = req.body;
  const employee = await employeeModel.findById(emp);
  if (!employee) {
    throw new AppError('Employee not found', 404);
  }

  const id = 'py_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const assignedBy = req.user ? (req.user.employeeId || req.user.id) : '';

  const payment = await paymentModel.create({
    id,
    emp,
    date,
    amount: Number(amount),
    type,
    note,
    assigned_by: assignedBy
  });

  await activityModel.create({
    id: 'act_' + Date.now(),
    text: `Recorded ${type} payment of ${formatINR(amount)} to ${employee.name}`,
    at: new Date().toISOString(),
    read: 0
  });

  return apiResponse.created(res, payment, 'Payment recorded successfully');
});

const updatePayment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await paymentModel.findById(id);
  if (!existing) {
    throw new AppError('Payment not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.amount !== undefined) {
    updateData.amount = Number(updateData.amount) || 0;
  }

  const updated = await paymentModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Payment updated successfully');
});

const deletePayment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await paymentModel.findById(id);
  if (!existing) {
    throw new AppError('Payment not found', 404);
  }

  await paymentModel.delete(id);
  return apiResponse.success(res, null, 'Payment deleted successfully');
});

module.exports = {
  getAllPayments,
  createPayment,
  updatePayment,
  deletePayment
};
