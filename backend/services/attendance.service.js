'use strict';

const attendanceModel = require('../models/attendance.model');
const employeeModel = require('../models/employee.model');
const leaveModel = require('../models/leave.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, minsBetween, workdaysIn, isLate, otHoursFor, shiftOf, HOURS_PER_DAY } = require('../utils/calculations');

const newId = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const hhmm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** Pure computation: month stats from preloaded rows. */
function computeMonthStats(rows, leaves, month) {
  let present = 0, half = 0, absent = 0, late = 0, otHours = 0, fineHours = 0, totalWorkedMinutes = 0, daysWithOut = 0;

  for (const r of rows) {
    const st = r.status || (r.clock_in ? 'present' : '');
    if (st === 'present') present++;
    else if (st === 'half') half++;
    else if (st === 'absent') absent++;
    if (Number(r.late)) late++;
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

  return {
    month, present, half, absent, late, leave: leaveDays, otHours, fineHours,
    workdaysSoFar, workdaysTotal, unaccounted, avgWorkingMinutes, totalWorkedMinutes,
    expectedMinutesSoFar: workdaysSoFar * HOURS_PER_DAY * 60,
    expectedMinutesTotal: workdaysTotal * HOURS_PER_DAY * 60
  };
}

class AttendanceService {
  async processClockIn(empId, { lat = null, lng = null, acc = null, addr = '', mode = 'office' } = {}) {
    const today = todayISO();
    const [existing, emp] = await Promise.all([attendanceModel.findByEmpAndDate(empId, today), employeeModel.findById(empId)]);

    if (existing && existing.clock_in && !existing.clock_out) throw new AppError('Already clocked in for today.', 400);
    if (existing && existing.clock_out) throw new AppError('Already completed attendance for today.', 400);

    const now = new Date();
    const timeStr = hhmm(now);
    const shift = emp ? emp.shift : 'day';
    const late = isLate(shift, timeStr) ? 1 : 0;

    const record = await attendanceModel.upsertPunch({
      id: existing ? existing.id : newId('a_'),
      emp: empId,
      date: today,
      clock_in: timeStr,
      clock_out: '',
      mode: mode || 'office',
      status: 'present',
      late,
      ot_hours: existing ? existing.ot_hours : 0,
      fine_hours: existing ? existing.fine_hours : 0,
      note: existing ? existing.note : '',
      in_lat: lat, in_lng: lng, in_acc: acc, in_addr: addr || ''
    });

    await activityModel.log(`${emp ? emp.name : 'Employee'} clocked in at ${timeStr}${late ? ' (late)' : ''}${addr ? ' from ' + addr : ''}`);
    return record;
  }

  async processClockOut(empId, { lat = null, lng = null, acc = null, addr = '' } = {}) {
    const today = todayISO();
    const [existing, emp] = await Promise.all([attendanceModel.findByEmpAndDate(empId, today), employeeModel.findById(empId)]);

    if (!existing || !existing.clock_in) throw new AppError('You have not clocked in yet today.', 400);
    if (existing.clock_out) throw new AppError('Already clocked out today.', 400);

    const timeStr = hhmm(new Date());
    const shift = emp ? emp.shift : 'day';
    // Overtime is automatic: hours after the shift's OT threshold (8 pm day / 11 pm evening)
    const ot = Math.max(Number(existing.ot_hours) || 0, otHoursFor(shift, timeStr));
    const record = await attendanceModel.update(existing.id, { clock_out: timeStr, ot_hours: ot, out_lat: lat, out_lng: lng, out_acc: acc, out_addr: addr || '' });

    const workedMins = minsBetween(existing.clock_in, timeStr);
    await activityModel.log(`${emp ? emp.name : 'Employee'} clocked out at ${timeStr} (${Math.floor(workedMins / 60)}h ${workedMins % 60}m worked${ot ? ', OT ' + ot + 'h' : ''})`);
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

  /** Per-employee month summary for the whole team (dashboard + reports). */
  async getTeamSummary(month = thisMonth()) {
    const [employees, rows, leaves] = await Promise.all([
      employeeModel.findAll({}, { orderBy: 'name ASC' }),
      attendanceModel.getMonthAttendanceAll(month),
      leaveModel.getLeavesInMonthAll(month)
    ]);
    const byEmp = {}; for (const r of rows) (byEmp[r.emp] = byEmp[r.emp] || []).push(r);
    const lvEmp = {}; for (const l of leaves) (lvEmp[l.emp] = lvEmp[l.emp] || []).push(l);
    const staff = employees.map(e => ({
      id: e.id, name: e.name, dept: e.dept, emp_id: e.emp_id, shift: e.shift || 'day', shiftLabel: shiftOf(e.shift).label,
      ...computeMonthStats(byEmp[e.id] || [], lvEmp[e.id] || [], month)
    }));
    const withHours = staff.filter(s => s.totalWorkedMinutes > 0);
    return {
      month,
      workdaysSoFar: workdaysIn(month, true),
      workdaysTotal: workdaysIn(month, false),
      staffCount: staff.length,
      avgWorkingMinutes: withHours.length ? Math.round(withHours.reduce((a, s) => a + s.avgWorkingMinutes, 0) / withHours.length) : 0,
      totalWorkedMinutes: staff.reduce((a, s) => a + s.totalWorkedMinutes, 0),
      expectedMinutesSoFar: staff.length * workdaysIn(month, true) * HOURS_PER_DAY * 60,
      otHours: staff.reduce((a, s) => a + s.otHours, 0),
      lateCount: staff.reduce((a, s) => a + s.late, 0),
      staff
    };
  }
}

module.exports = new AttendanceService();
