'use strict';

const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', protect, restrictTo('admin'), payrollController.getPayroll);
router.post('/pay-all', protect, restrictTo('admin'), payrollController.payAllPendingSalaries);

module.exports = router;
