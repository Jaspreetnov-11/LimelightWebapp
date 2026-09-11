'use strict';

const employeeModel = require('../models/employee.model');
const attendanceModel = require('../models/attendance.model');
const paymentModel = require('../models/payment.model');
const taskModel = require('../models/task.model');
const projectModel = require('../models/project.model');
const payrollService = require('./payroll.service');
const attendanceService = require('./attendance.service');
const { thisMonth } = require('../utils/calculations');

function toCsv(headers, rows) {
  const sanitize = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  return '﻿' + [headers.map(sanitize).join(','), ...rows.map(r => r.map(sanitize).join(','))].join('\n');
}
const hrs = mins => (Math.round(((Number(mins) || 0) / 60) * 10) / 10).toFixed(1);

class ReportService {
  async getAttendanceRegisterCsv(month = thisMonth()) {
    const [employees, attendance] = await Promise.all([
      employeeModel.findAll({}, { orderBy: 'name ASC' }),
      attendanceModel.getMonthAttendanceAll(month)
    ]);
    const [y, mo] = month.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) days.push(month + '-' + String(d).padStart(2, '0'));

    const headers = ['Staff Name', 'Emp ID', 'Department', ...days.map(d => d.slice(8))];
    const codeMap = { present: 'P', half: 'HD', absent: 'A', leave: 'L' };
    const byKey = {};
    for (const a of attendance) byKey[a.emp + '|' + a.date] = a;

    const rows = employees.map(e => [e.name, e.emp_id || '', e.dept || '', ...days.map(d => {
      const punch = byKey[e.id + '|' + d];
      if (!punch) return '-';
      return (codeMap[punch.status] || (punch.clock_in ? 'P' : '-')) + (Number(punch.late) ? '*' : '');
    })]);
    return toCsv(headers, rows);
  }

  async getPayrollSummaryCsv(month = thisMonth()) {
    const payroll = await payrollService.calculateMonthlyPayroll(month);
    const headers = ['Staff Name', 'Emp ID', 'Department', 'Salary', 'Present Days', 'Half Days', 'Leaves', 'Overtime Hours', 'Fine Hours', 'Earned', 'Paid', 'Pending Balance'];
    const rows = payroll.rows.map(r => [r.employee.name, r.employee.empId, r.employee.dept, r.employee.salary, r.stats.present, r.stats.half, r.stats.leave, r.stats.otHours, r.stats.fineHours, r.earned, r.paid, r.pending]);
    return toCsv(headers, rows);
  }

  /** Average working hours, hours vs expected, OT, late days and tasks delivered per staff. */
  async getStaffPerformanceCsv(month = thisMonth()) {
    const [team, tasks] = await Promise.all([attendanceService.getTeamSummary(month), taskModel.findAll()]);
    const delivered = {}, onTime = {}, assigned = {};
    for (const t of tasks) {
      const ids = String(t.assignee || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const id of ids) {
        if (String(t.assigned || '').slice(0, 7) === month) assigned[id] = (assigned[id] || 0) + 1;
        if (t.status === 'completed' && String(t.completed || '').slice(0, 7) === month) {
          delivered[id] = (delivered[id] || 0) + 1;
          if (!t.deadline || t.completed <= t.deadline) onTime[id] = (onTime[id] || 0) + 1;
        }
      }
    }
    const headers = ['Staff Name', 'Emp ID', 'Department', 'Shift', 'Days Present', 'Late Days', 'Avg Working Hours / Day', 'Total Hours', 'Expected Hours', 'Overtime Hours', 'Tasks Assigned', 'Tasks Delivered', 'Delivered On Time'];
    const rows = team.staff.map(s => [
      s.name, s.emp_id || '', s.dept || '', s.shiftLabel, s.present + s.half, s.late,
      hrs(s.avgWorkingMinutes), hrs(s.totalWorkedMinutes), hrs(s.expectedMinutesSoFar), s.otHours,
      assigned[s.id] || 0, delivered[s.id] || 0, onTime[s.id] || 0
    ]);
    return toCsv(headers, rows);
  }

  async getPaymentsLedgerCsv() {
    const [payments, employees] = await Promise.all([paymentModel.findAll({}, { orderBy: 'date DESC' }), employeeModel.findAll()]);
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    return toCsv(['Date', 'Staff Name', 'Payment Type', 'Amount (INR)', 'Note'], payments.map(p => [p.date, empMap[p.emp] || p.emp, p.type, p.amount, p.note || '']));
  }

  async getStaffDirectoryCsv() {
    const employees = await employeeModel.findAll({}, { orderBy: 'name ASC' });
    return toCsv(['Name', 'Emp ID', 'Designation', 'Department', 'Email', 'Phone', 'Date Joined', 'Shift', 'Salary (Monthly)'],
      employees.map(e => [e.name, e.emp_id || '', e.role || '', e.dept || '', e.email || '', e.phone || '', e.joined || '', e.shift || 'day', e.salary || 0]));
  }

  async getTasksCsv() {
    const [tasks, projects, employees] = await Promise.all([taskModel.findAll({}, { orderBy: 'created_at DESC' }), projectModel.findAll(), employeeModel.findAll()]);
    const projMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    const headers = ['Task Title', 'Project', 'Department', 'Assignee', 'Assigned Date', 'Deadline', 'Completed', 'Estimated Hours', 'Hours Taken', 'Status'];
    const rows = tasks.map(t => [
      t.title, projMap[t.project] || '', t.dept || '',
      t.assignee ? String(t.assignee).split(',').map(id => empMap[id.trim()] || id.trim()).join(', ') : 'Unassigned',
      t.assigned || '', t.deadline || '', t.completed || '', hrs(t.mins), hrs(t.taken_mins), t.status
    ]);
    return toCsv(headers, rows);
  }

  async getProjectsCsv() {
    const projects = await projectModel.listWithConsumedMinutes();
    const headers = ['Project Name', 'Client', 'Billable', 'Allocated Hours', 'Estimated Hours', 'Hours Taken', 'Progress %', 'Tasks', 'Completed', 'Status'];
    const rows = projects.map(p => {
      const alloc = Number(p.alloc) || 0, consumed = Number(p.consumed_mins) || 0;
      const pct = alloc > 0 ? Math.round((consumed / alloc) * 100) : (consumed > 0 ? 100 : 0);
      return [p.name, p.client || '', Number(p.billable) ? 'Yes' : 'No', hrs(alloc), hrs(p.est_mins), hrs(consumed), `${pct}%`, p.task_count, p.completed_task_count, p.status];
    });
    return toCsv(headers, rows);
  }
}

module.exports = new ReportService();
