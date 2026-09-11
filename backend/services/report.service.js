'use strict';

const employeeModel = require('../models/employee.model');
const attendanceModel = require('../models/attendance.model');
const paymentModel = require('../models/payment.model');
const taskModel = require('../models/task.model');
const projectModel = require('../models/project.model');
const payrollService = require('./payroll.service');
const { thisMonth } = require('../utils/calculations');

function toCsv(headers, rows) {
  const sanitize = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const headerLine = headers.map(sanitize).join(',');
  const rowLines = rows.map(r => r.map(sanitize).join(','));
  return '\uFEFF' + [headerLine, ...rowLines].join('\n');
}

class ReportService {
  getAttendanceRegisterCsv(month = thisMonth()) {
    const employees = employeeModel.findAll({}, { orderBy: 'name ASC' });
    const attendance = attendanceModel.findAll();

    const [y, mo] = month.split('-').map(Number);
    const lastDay = new Date(y, mo, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      days.push(month + '-' + String(d).padStart(2, '0'));
    }

    const headers = ['Staff Name', 'Emp ID', 'Department', ...days.map(d => d.slice(8))];
    const codeMap = { present: 'P', half: 'HD', absent: 'A', leave: 'L' };

    const rows = employees.map(e => {
      const dayStatuses = days.map(d => {
        const punch = attendance.find(a => a.emp === e.id && a.date === d);
        if (!punch) return '-';
        return codeMap[punch.status] || (punch.clock_in ? 'P' : '-');
      });
      return [e.name, e.emp_id || '', e.dept || '', ...dayStatuses];
    });

    return toCsv(headers, rows);
  }

  getPayrollSummaryCsv(month = thisMonth()) {
    const payroll = payrollService.calculateMonthlyPayroll(month);
    const headers = ['Staff Name', 'Emp ID', 'Department', 'Salary', 'Present Days', 'Half Days', 'Leaves', 'Overtime Hours', 'Fine Hours', 'Earned', 'Paid', 'Pending Balance'];

    const rows = payroll.rows.map(r => [
      r.employee.name,
      r.employee.empId,
      r.employee.dept,
      r.employee.salary,
      r.stats.present,
      r.stats.half,
      r.stats.leave,
      r.stats.otHours,
      r.stats.fineHours,
      r.earned,
      r.paid,
      r.pending
    ]);

    return toCsv(headers, rows);
  }

  getPaymentsLedgerCsv() {
    const payments = paymentModel.findAll({}, { orderBy: 'date DESC' });
    const employees = employeeModel.findAll();
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

    const headers = ['Date', 'Staff Name', 'Payment Type', 'Amount (INR)', 'Note'];
    const rows = payments.map(p => [
      p.date,
      empMap[p.emp] || p.emp,
      p.type,
      p.amount,
      p.note || ''
    ]);

    return toCsv(headers, rows);
  }

  getStaffDirectoryCsv() {
    const employees = employeeModel.findAll({}, { orderBy: 'name ASC' });
    const headers = ['Name', 'Emp ID', 'Designation', 'Department', 'Email', 'Phone', 'Date Joined', 'Salary (Monthly)'];

    const rows = employees.map(e => [
      e.name,
      e.emp_id || '',
      e.role || '',
      e.dept || '',
      e.email || '',
      e.phone || '',
      e.joined || '',
      e.salary || 0
    ]);

    return toCsv(headers, rows);
  }

  getTasksCsv() {
    const tasks = taskModel.findAll({}, { orderBy: 'created_at DESC' });
    const projects = projectModel.findAll();
    const employees = employeeModel.findAll();
    const projMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

    const headers = ['Task Title', 'Project', 'Assignee', 'Assigned Date', 'Deadline', 'Minutes Logged', 'Status'];
    const rows = tasks.map(t => [
      t.title,
      projMap[t.project] || 'Personal / Operational',
      empMap[t.assignee] || 'Unassigned',
      t.assigned || '',
      t.deadline || '',
      t.mins || 0,
      t.status
    ]);

    return toCsv(headers, rows);
  }

  getProjectsCsv() {
    const projects = projectModel.listWithConsumedMinutes();
    const headers = ['Project Name', 'Client', 'Billable', 'Allocated Minutes', 'Consumed Minutes', 'Progress %', 'Status'];

    const rows = projects.map(p => {
      const alloc = Number(p.alloc) || 0;
      const consumed = Number(p.consumed_mins) || 0;
      const pct = alloc > 0 ? Math.round((consumed / alloc) * 100) : (consumed > 0 ? 100 : 0);
      return [
        p.name,
        p.client || '',
        p.billable ? 'Yes' : 'No',
        alloc,
        consumed,
        `${pct}%`,
        p.status
      ];
    });

    return toCsv(headers, rows);
  }
}

module.exports = new ReportService();
