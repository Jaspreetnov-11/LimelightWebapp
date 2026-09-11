'use strict';

const employeeModel = require('../models/employee.model');
const paymentModel = require('../models/payment.model');
const attendanceModel = require('../models/attendance.model');
const leaveModel = require('../models/leave.model');
const attendanceService = require('./attendance.service');
const activityModel = require('../models/activity.model');
const { thisMonth, workdaysIn, calculateEarnedSalary, todayISO } = require('../utils/calculations');

const groupBy = (rows, key) => {
  const m = {};
  for (const r of rows) (m[r[key]] = m[r[key]] || []).push(r);
  return m;
};

class PayrollService {
  /** Three queries for the whole month, shared by every employee's calculation. */
  async preloadMonth(month = thisMonth()) {
    const [att, leaves, paid] = await Promise.all([
      attendanceModel.getMonthAttendanceAll(month),
      leaveModel.getLeavesInMonthAll(month),
      paymentModel.getTotalPaidAll(month)
    ]);
    return { month, attByEmp: groupBy(att, 'emp'), leavesByEmp: groupBy(leaves, 'emp'), paidByEmp: paid };
  }

  computeEmployeePayroll(employee, month, pre) {
    const st = attendanceService.computeMonthStats(pre.attByEmp[employee.id] || [], pre.leavesByEmp[employee.id] || [], month);
    const earned = calculateEarnedSalary(employee.salary, workdaysIn(month, false), st.present, st.half, st.leave, st.otHours, st.fineHours);
    const paid = pre.paidByEmp[employee.id] || 0;
    const pending = earned - paid;
    return {
      employee: {
        id: employee.id, name: employee.name, empId: employee.emp_id, role: employee.role, dept: employee.dept,
        salary: Number(employee.salary) || 0, av: employee.av, ini: employee.ini
      },
      stats: st,
      earned,
      paid,
      pending,
      status: pending > 0 ? 'Pending' : pending < 0 ? 'Advance' : 'Settled'
    };
  }

  async getEmployeePayroll(employee, month = thisMonth()) {
    const [st, paid] = await Promise.all([
      attendanceService.getMonthStats(employee.id, month),
      paymentModel.getTotalPaidForEmployee(employee.id, month)
    ]);
    const pre = { attByEmp: {}, leavesByEmp: {}, paidByEmp: { [employee.id]: paid } };
    const out = this.computeEmployeePayroll(employee, month, pre);
    out.stats = st;
    out.earned = calculateEarnedSalary(employee.salary, workdaysIn(month, false), st.present, st.half, st.leave, st.otHours, st.fineHours);
    out.pending = out.earned - paid;
    out.status = out.pending > 0 ? 'Pending' : out.pending < 0 ? 'Advance' : 'Settled';
    return out;
  }

  async calculateMonthlyPayroll(month = thisMonth()) {
    const [employees, pre] = await Promise.all([
      employeeModel.findAll({}, { orderBy: 'name ASC' }),
      this.preloadMonth(month)
    ]);
    const rows = employees.map(e => this.computeEmployeePayroll(e, month, pre));

    return {
      month,
      workdaysElapsed: workdaysIn(month, true),
      workdaysTotal: workdaysIn(month, false),
      summary: {
        staffCount: employees.length,
        totalSalary: employees.reduce((a, e) => a + (Number(e.salary) || 0), 0),
        totalEarned: rows.reduce((a, r) => a + r.earned, 0),
        totalPaid: rows.reduce((a, r) => a + r.paid, 0),
        totalPending: rows.reduce((a, r) => a + r.pending, 0)
      },
      rows
    };
  }

  async payAllPending(month = thisMonth(), assignedById = '') {
    const payroll = await this.calculateMonthlyPayroll(month);
    const dueList = payroll.rows.filter(r => r.pending > 0);
    const today = todayISO();
    const paymentsRecorded = [];

    for (const item of dueList) {
      const payment = await paymentModel.create({
        id: 'py_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
        emp: item.employee.id,
        date: today,
        amount: Math.round(item.pending),
        type: 'Salary',
        note: `Payroll settlement for ${month}`,
        assigned_by: assignedById
      });
      paymentsRecorded.push(payment);
    }

    if (paymentsRecorded.length > 0) {
      await activityModel.log(`Processed salary payments for ${paymentsRecorded.length} staff (${month})`);
    }

    return {
      count: paymentsRecorded.length,
      totalAmount: paymentsRecorded.reduce((a, p) => a + (Number(p.amount) || 0), 0),
      payments: paymentsRecorded
    };
  }
}

module.exports = new PayrollService();
