'use strict';

const express = require('express');
const router = express.Router();
const performance = require('../services/performance.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const { protect } = require('../middleware/auth.middleware');
const { thisMonth } = require('../utils/calculations');

// Everyone can see the leaderboard: it is meant to be visible on every dashboard.
router.get('/', protect, catchAsync(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : thisMonth();
  return apiResponse.success(res, await performance.computeMonth(month));
}));

module.exports = router;
