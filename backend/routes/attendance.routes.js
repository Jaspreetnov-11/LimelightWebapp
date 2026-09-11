'use strict';

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { clockInSchema, clockOutSchema, manualAttendanceSchema } = require('../validators/attendance.validator');

router.post('/clock-in', protect, validate(clockInSchema), attendanceController.clockIn);
router.post('/clock-out', protect, validate(clockOutSchema), attendanceController.clockOut);
router.get('/today', attendanceController.getTodayStatus);
router.get('/stats/:empId', attendanceController.getEmployeeMonthStats);
router.get('/', attendanceController.getAttendanceList);
router.put('/:id', protect, restrictTo('admin', 'manager'), attendanceController.updateAttendance);

module.exports = router;
