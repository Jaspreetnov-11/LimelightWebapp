'use strict';

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Reports are admin-only
router.use(protect, restrictTo('admin'));

router.get('/attendance-register', reportController.exportAttendanceRegister);
router.get('/payroll-summary', reportController.exportPayrollSummary);
router.get('/payments-ledger', reportController.exportPaymentsLedger);
router.get('/staff-directory', reportController.exportStaffDirectory);
router.get('/staff-performance', reportController.exportStaffPerformance);
router.get('/tasks', reportController.exportTasks);
router.get('/projects', reportController.exportProjects);

module.exports = router;
