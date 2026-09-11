'use strict';

const reportService = require('../services/report.service');
const catchAsync = require('../utils/catchAsync');
const { thisMonth } = require('../utils/calculations');

const sendCsv = (res, filename, csv) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
};

const exportAttendanceRegister = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  return sendCsv(res, `attendance-register-${month}.csv`, await reportService.getAttendanceRegisterCsv(month));
});

const exportPayrollSummary = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  return sendCsv(res, `payroll-${month}.csv`, await reportService.getPayrollSummaryCsv(month));
});

const exportPaymentsLedger = catchAsync(async (req, res) => sendCsv(res, 'payments-all.csv', await reportService.getPaymentsLedgerCsv()));
const exportStaffDirectory = catchAsync(async (req, res) => sendCsv(res, 'staff.csv', await reportService.getStaffDirectoryCsv()));

const exportStaffPerformance = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  return sendCsv(res, `staff-performance-${month}.csv`, await reportService.getStaffPerformanceCsv(month));
});

const exportTasks = catchAsync(async (req, res) => sendCsv(res, 'tasks.csv', await reportService.getTasksCsv()));
const exportProjects = catchAsync(async (req, res) => sendCsv(res, 'projects.csv', await reportService.getProjectsCsv()));

module.exports = { exportAttendanceRegister, exportPayrollSummary, exportPaymentsLedger, exportStaffDirectory, exportStaffPerformance, exportTasks, exportProjects };
