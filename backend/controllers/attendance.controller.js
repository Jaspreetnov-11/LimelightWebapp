'use strict';

const attendanceModel = require('../models/attendance.model');
const attendanceService = require('../services/attendance.service');
const employeeModel = require('../models/employee.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO, thisMonth } = require('../utils/calculations');

const clockIn = catchAsync(async (req, res) => {
  const empId = req.user.employeeId;
  if (!empId) {
    throw new AppError('No employee profile linked to this user.', 400);
  }

  const { lat, lng, acc, addr, mode } = req.body;
  const punch = await attendanceService.processClockIn(empId, { lat, lng, acc, addr, mode });
  return apiResponse.success(res, punch, 'Clocked in successfully');
});

const clockOut = catchAsync(async (req, res) => {
  const empId = req.user.employeeId;
  if (!empId) {
    throw new AppError('No employee profile linked to this user.', 400);
  }

  const { lat, lng, acc, addr } = req.body;
  const punch = await attendanceService.processClockOut(empId, { lat, lng, acc, addr });
  return apiResponse.success(res, punch, 'Clocked out successfully');
});

const getTodayStatus = catchAsync(async (req, res) => {
  const today = todayISO();
  const empId = req.user ? req.user.employeeId : null;

  let myPunch = null;
  if (empId) {
    myPunch = attendanceModel.findByEmpAndDate(empId, today);
  }

  const allToday = attendanceModel.listDayAttendance(today);
  const totalStaff = employeeModel.count();

  const present = allToday.filter(a => a.status === 'present' || a.clock_in).length;
  const half = allToday.filter(a => a.status === 'half').length;
  const absent = allToday.filter(a => a.status === 'absent').length;
  const wfh = allToday.filter(a => a.mode === 'wfh').length;

  return apiResponse.success(res, {
    today,
    myPunch,
    summary: {
      totalStaff,
      present,
      half,
      absent,
      wfh,
      notMarked: Math.max(0, totalStaff - present - half - absent)
    },
    staffAttendance: allToday
  });
});

const getAttendanceList = catchAsync(async (req, res) => {
  const { date = todayISO(), empId } = req.query;

  let records;
  if (empId) {
    records = attendanceModel.findAll({ emp: empId }, { orderBy: 'date DESC', limit: 100 });
  } else {
    records = attendanceModel.listDayAttendance(date);
  }

  return apiResponse.success(res, records);
});

const updateAttendance = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = attendanceModel.findById(id);
  if (!existing) {
    throw new AppError('Attendance entry not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.ot_hours !== undefined) updateData.ot_hours = Number(updateData.ot_hours) || 0;
  if (updateData.fine_hours !== undefined) updateData.fine_hours = Number(updateData.fine_hours) || 0;

  const updated = attendanceModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Attendance updated successfully');
});

const getEmployeeMonthStats = catchAsync(async (req, res) => {
  const { empId } = req.params;
  const { month = thisMonth() } = req.query;

  const stats = attendanceService.getMonthStats(empId, month);
  return apiResponse.success(res, stats);
});

module.exports = {
  clockIn,
  clockOut,
  getTodayStatus,
  getAttendanceList,
  updateAttendance,
  getEmployeeMonthStats
};
