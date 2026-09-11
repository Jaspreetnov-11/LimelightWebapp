'use strict';

const reportService = require('../services/report.service');
const catchAsync = require('../utils/catchAsync');
const { thisMonth } = require('../utils/calculations');

const exportAttendanceRegister = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  const csv = reportService.getAttendanceRegisterCsv(month);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-register-${month}.csv"`);
  return res.send(csv);
});

const exportPayrollSummary = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  const csv = reportService.getPayrollSummaryCsv(month);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="payroll-${month}.csv"`);
  return res.send(csv);
});

const exportPaymentsLedger = catchAsync(async (req, res) => {
  const csv = reportService.getPaymentsLedgerCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payments-all.csv"');
  return res.send(csv);
});

const exportStaffDirectory = catchAsync(async (req, res) => {
  const csv = reportService.getStaffDirectoryCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="staff.csv"');
  return res.send(csv);
});

const exportTasks = catchAsync(async (req, res) => {
  const csv = reportService.getTasksCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');
  return res.send(csv);
});

const exportProjects = catchAsync(async (req, res) => {
  const csv = reportService.getProjectsCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
  return res.send(csv);
});

module.exports = {
  exportAttendanceRegister,
  exportPayrollSummary,
  exportPaymentsLedger,
  exportStaffDirectory,
  exportTasks,
  exportProjects
};
