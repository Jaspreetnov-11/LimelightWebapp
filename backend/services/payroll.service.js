'use strict';

const employeeModel = require('../models/employee.model');
const paymentModel = require('../models/payment.model');
const attendanceService = require('./attendance.service');
const activityModel = require('../models/activity.model');
const { thisMonth, workdaysIn, calculateEarnedSalary, todayISO } = require('../utils/calculations');

class PayrollService {
  getEmployeePayroll(employee, month = thisMonth()) {
    const st = attendanceService.getMonthStats(employee.id, month);
    const workdaysFull = workdaysIn(month, false);

    const earned = calculateEarnedSalary(
      employee.salary,
      workdaysFull,
      st.present,
      st.half,
      st.leave,
      st.otHours,
      st.fineHours
    );

    const paid = paymentModel.getTotalPaidForEmployee(employee.id, month);
    const pending = earned - paid;

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        empId: employee.emp_id,
        role: employee.role,
        dept: employee.dept,
        salary: Number(employee.salary) || 0,
        av: employee.av,
        ini: employee.ini
      },
      stats: st,
      earned,
      paid,
      pending,
      status: pending > 0 ? 'Pending' : pending < 0 ? 'Advance' : 'Settled'
    };
  }

  calculateMonthlyPayroll(month = thisMonth()) {
    const employees = employeeModel.findAll({}, { orderBy: 'name ASC' });
    const rows = employees.map(e => this.getEmployeePayroll(e, month));

    const totalSalary = employees.reduce((acc, e) => acc + (Number(e.salary) || 0), 0);
    const totalEarned = rows.reduce((acc, r) => acc + r.earned, 0);
    const totalPaid = rows.reduce((acc, r) => acc + r.paid, 0);
    const totalPending = rows.reduce((acc, r) => acc + r.pending, 0);

    return {
      month,
      workdaysElapsed: workdaysIn(month, true),
      workdaysTotal: workdaysIn(month, false),
      summary: {
        staffCount: employees.length,
        totalSalary,
        totalEarned,
        totalPaid,
        totalPending
      },
      rows
    };
  }

  payAllPending(month = thisMonth(), assignedById = '') {
    const payroll = this.calculateMonthlyPayroll(month);
    const dueList = payroll.rows.filter(r => r.pending > 0);

    const paymentsRecorded = [];
    const today = todayISO();

    for (const item of dueList) {
      const payment = paymentModel.create({
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
      activityModel.create({
        id: 'act_' + Date.now(),
        text: `Processed salary payments for ${paymentsRecorded.length} staff (${month})`,
        at: new Date().toISOString(),
        read: 0
      });
    }

    return {
      count: paymentsRecorded.length,
      totalAmount: paymentsRecorded.reduce((a, p) => a + p.amount, 0),
      payments: paymentsRecorded
    };
  }
}

module.exports = new PayrollService();
