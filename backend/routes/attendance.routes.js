'use strict';

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { clockInSchema, clockOutSchema, manualAttendanceSchema } = require('../validators/attendance.validator');

router.post('/clock-in', protect, validate(clockInSchema), attendanceController.clockIn);
router.post('/clock-out', protect, validate(clockOutSchema), attendanceController.clockOut);
router.get('/today', optionalAuth, attendanceController.getTodayStatus);
router.post('/mark', protect, restrictTo('admin', 'manager'), validate(manualAttendanceSchema), attendanceController.markAttendance);
router.get('/team-summary', protect, restrictTo('admin', 'manager'), attendanceController.getTeamSummary);
router.get('/stats/:empId', protect, attendanceController.getEmployeeMonthStats);
router.get('/', protect, attendanceController.getAttendanceList);
router.put('/:id', protect, restrictTo('admin', 'manager'), attendanceController.updateAttendance);

module.exports = router;
