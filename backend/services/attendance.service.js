'use strict';

const attendanceModel = require('../models/attendance.model');
const employeeModel = require('../models/employee.model');
const leaveModel = require('../models/leave.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, minsBetween, workdaysIn } = require('../utils/calculations');

class AttendanceService {
  async processClockIn(empId, { lat = null, lng = null, acc = null, addr = '', mode = 'office' } = {}) {
    const today = todayISO();
    const existing = attendanceModel.findByEmpAndDate(empId, today);

    if (existing && existing.clock_in && !existing.clock_out) {
      throw new AppError('Already clocked in for today.', 400);
    }
    if (existing && existing.clock_out) {
      throw new AppError('Already completed attendance for today.', 400);
    }

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const punchData = {
      id: existing ? existing.id : 'a_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
      emp: empId,
      date: today,
      clock_in: timeStr,
      clock_out: '',
      mode: mode || 'office',
      status: 'present',
      ot_hours: 0,
      fine_hours: 0,
      note: '',
      in_lat: lat,
      in_lng: lng,
      in_acc: acc,
      in_addr: addr
    };

    const record = attendanceModel.upsertPunch(punchData);

    const emp = employeeModel.findById(empId);
    const empName = emp ? emp.name : 'Employee';
    activityModel.create({
      id: 'act_' + Date.now(),
      text: `${empName} clocked in at ${timeStr}${addr ? ' from ' + addr : ''}`,
      at: now.toISOString(),
      read: 0
    });

    return record;
  }

  async processClockOut(empId, { lat = null, lng = null, acc = null, addr = '' } = {}) {
    const today = todayISO();
    const existing = attendanceModel.findByEmpAndDate(empId, today);

    if (!existing || !existing.clock_in) {
      throw new AppError('You have not clocked in yet today.', 400);
    }
    if (existing.clock_out) {
      throw new AppError('Already clocked out today.', 400);
    }

    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const updateData = {
      clock_out: timeStr,
      out_lat: lat,
      out_lng: lng,
      out_acc: acc,
      out_addr: addr
    };

    const record = attendanceModel.update(existing.id, updateData);

    const emp = employeeModel.findById(empId);
    const empName = emp ? emp.name : 'Employee';
    const workedMins = minsBetween(existing.clock_in, timeStr);
    const workedHrs = `${Math.floor(workedMins / 60)}h ${workedMins % 60}m`;

    activityModel.create({
      id: 'act_' + Date.now(),
      text: `${empName} clocked out at ${timeStr} (${workedHrs} worked)`,
      at: now.toISOString(),
      read: 0
    });

    return record;
  }

  getMonthStats(empId, month = thisMonth()) {
    const rows = attendanceModel.getMonthAttendance(empId, month);
    const leaves = leaveModel.getEmployeeLeaves(empId, month);

    let present = 0;
    let half = 0;
    let absent = 0;
    let otHours = 0;
    let fineHours = 0;
    let totalWorkedMinutes = 0;
    let daysWithOut = 0;

    for (const r of rows) {
      const st = r.status || (r.clock_in ? 'present' : '');
      if (st === 'present') present++;
      else if (st === 'half') half++;
      else if (st === 'absent') absent++;

      otHours += Number(r.ot_hours) || 0;
      fineHours += Number(r.fine_hours) || 0;

      if (r.clock_in && r.clock_out) {
        totalWorkedMinutes += minsBetween(r.clock_in, r.clock_out);
        daysWithOut++;
      }
    }

    // Leave count calculation from leaves table
    let leaveDays = 0;
    for (const l of leaves) {
      const start = new Date(l.from_date + 'T00:00:00');
      const end = new Date(l.to_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        if (iso.slice(0, 7) === month && d.getDay() !== 0) {
          leaveDays++;
        }
      }
    }

    const workdaysSoFar = workdaysIn(month, true);
    const workdaysTotal = workdaysIn(month, false);
    const unaccounted = Math.max(0, workdaysSoFar - present - half - absent - leaveDays);
    const avgWorkingMinutes = daysWithOut > 0 ? Math.round(totalWorkedMinutes / daysWithOut) : 0;

    return {
      month,
      present,
      half,
      absent,
      leave: leaveDays,
      otHours,
      fineHours,
      workdaysSoFar,
      workdaysTotal,
      unaccounted,
      avgWorkingMinutes
    };
  }
}

module.exports = new AttendanceService();
