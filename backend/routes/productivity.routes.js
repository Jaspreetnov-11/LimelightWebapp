'use strict';

const express = require('express');
const router = express.Router();
const productivity = require('../services/productivity.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const { protect } = require('../middleware/auth.middleware');
const { thisMonth } = require('../utils/calculations');

// Everyone sees the team's productive hours (same visibility as the dashboard leaderboard).
router.get('/', protect, catchAsync(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : thisMonth();
  return apiResponse.success(res, await productivity.computeMonth(month));
}));

module.exports = router;
