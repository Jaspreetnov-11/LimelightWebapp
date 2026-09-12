'use strict';

const express = require('express');
const router = express.Router();
const performance = require('../services/performance.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const AppError = require('../utils/appError');
const employeeModel = require('../models/employee.model');
const { thisMonth } = require('../utils/calculations');

// Everyone can see the leaderboard: it is meant to be visible on every dashboard.
router.get('/', protect, catchAsync(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : thisMonth();
  return apiResponse.success(res, await performance.computeMonth(month));
}));

// Admin gives the manual half of the score (0-50) per person per month.
router.put('/rating', protect, restrictTo('admin'), catchAsync(async (req, res) => {
  const { emp, marks, note } = req.body;
  const month = /^\d{4}-\d{2}$/.test(String(req.body.month || '')) ? req.body.month : thisMonth();
  if (!emp || !(await employeeModel.findById(emp))) throw new AppError('Employee not found', 404);
  if (marks === undefined || marks === null || marks === '' || Number.isNaN(Number(marks))) throw new AppError('Marks must be a number from 0 to 50', 400);
  const saved = await performance.rate({ emp, month, marks, note, by: req.user.id });
  return apiResponse.success(res, saved, 'Marks saved');
}));

module.exports = router;
