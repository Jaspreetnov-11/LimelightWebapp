'use strict';

const attendanceModel = require('../models/attendance.model');
const employeeModel = require('../models/employee.model');
const leaveModel = require('../models/leave.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, minsBetween, workdaysIn } = require('../utils/calculations');

const newId = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** Pure computation: month stats from preloaded rows. */
function computeMonthStats(rows, leaves, month) {
  let present = 0, half = 0, absent = 0, otHours = 0, fineHours = 0, totalWorkedMinutes = 0, daysWithOut = 0;

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

  let leaveDays = 0;
  for (const l of leaves) {
    if (l.status && l.status !== 'approved') continue;
    const start = new Date(String(l.from_date).slice(0, 10) + 'T00:00:00');
    const end = new Date(String(l.to_date).slice(0, 10) + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso.slice(0, 7) === month && d.getDay() !== 0) leaveDays++;
    }
  }

  const workdaysSoFar = workdaysIn(month, true);
  const workdaysTotal = workdaysIn(month, false);
  const unaccounted = Math.max(0, workdaysSoFar - present - half - absent - leaveDays);
  const avgWorkingMinutes = daysWithOut > 0 ? Math.round(totalWorkedMinutes / daysWithOut) : 0;

  return { month, present, half, absent, leave: leaveDays, otHours, fineHours, workdaysSoFar, workdaysTotal, unaccounted, avgWorkingMinutes };
}

class AttendanceService {
  async processClockIn(empId, { lat = null, lng = null, acc = null, addr = '', mode = 'office' } = {}) {
    const today = todayISO();
    const existing = await attendanceModel.findByEmpAndDate(empId, today);

    if (existing && existing.clock_in && !existing.clock_out) throw new AppError('Already clocked in for today.', 400);
    if (existing && existing.clock_out) throw new AppError('Already completed attendance for today.', 400);

    const now = new Date();
    const timeStr = hhmm(now);

    const record = await attendanceModel.upsertPunch({
      id: existing ? existing.id : newId('a_'),
      emp: empId,
      date: today,
      clock_in: timeStr,
      clock_out: '',
      mode: mode || 'office',
      status: 'present',
      ot_hours: existing ? existing.ot_hours : 0,
      fine_hours: existing ? existing.fine_hours : 0,
      note: existing ? existing.note : '',
      in_lat: lat, in_lng: lng, in_acc: acc, in_addr: addr || ''
    });

    const emp = await employeeModel.findById(empId);
    await activityModel.log(`${emp ? emp.name : 'Employee'} clocked in at ${timeStr}${addr ? ' from ' + addr : ''}`);
    return record;
  }

  async processClockOut(empId, { lat = null, lng = null, acc = null, addr = '' } = {}) {
    const today = todayISO();
    const existing = await attendanceModel.findByEmpAndDate(empId, today);

    if (!existing || !existing.clock_in) throw new AppError('You have not clocked in yet today.', 400);
    if (existing.clock_out) throw new AppError('Already clocked out today.', 400);

    const timeStr = hhmm(new Date());
    const record = await attendanceModel.update(existing.id, { clock_out: timeStr, out_lat: lat, out_lng: lng, out_acc: acc, out_addr: addr || '' });

    const emp = await employeeModel.findById(empId);
    const workedMins = minsBetween(existing.clock_in, timeStr);
    await activityModel.log(`${emp ? emp.name : 'Employee'} clocked out at ${timeStr} (${Math.floor(workedMins / 60)}h ${workedMins % 60}m worked)`);
    return record;
  }

  computeMonthStats(rows, leaves, month) {
    return computeMonthStats(rows, leaves, month);
  }

  async getMonthStats(empId, month = thisMonth()) {
    const [rows, leaves] = await Promise.all([
      attendanceModel.getMonthAttendance(empId, month),
      leaveModel.getEmployeeLeaves(empId, month)
    ]);
    return computeMonthStats(rows, leaves, month);
  }
}

module.exports = new AttendanceService();
