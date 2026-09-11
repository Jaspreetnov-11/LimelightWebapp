'use strict';

const attendanceModel = require('../models/attendance.model');
const employeeModel = require('../models/employee.model');
const leaveModel = require('../models/leave.model');
const activityModel = require('../models/activity.model');
const AppError = require('../utils/appError');
const { todayISO, thisMonth, nowHHMM, workdaysIn, isLate, otHoursFor, punchMinutes, shiftOf, hoursPerDay } = require('../utils/calculations');

const yesterdayOf = iso => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const MODES = ['office', 'wfh', 'field'];

const settingsService = require('./settings.service');
const db = require('../config/db');

const newId = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

// ---- selfies: small JPEG/PNG data URLs stored with the punch, purged after N days
const SELFIE_MAX_BYTES = 80 * 1024;
function cleanSelfie(selfie, required, label) {
  const s = typeof selfie === 'string' ? selfie.trim() : '';
  if (!s) { if (required) throw new AppError(`A selfie is required to ${label}. Allow the camera and try again.`, 400); return null; }
  const m = s.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new AppError('Selfie must be a JPEG or PNG image.', 400);
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > SELFIE_MAX_BYTES) throw new AppError('Selfie is too large. Please retake it.', 400);
  return s;
}
let lastPurge = '';
async function purgeOldSelfies() {
  const today = todayISO();
  if (lastPurge === today) return;
  lastPurge = today;
  const days = settingsService.get().selfieRetentionDays || 30;
  const cutoff = new Date(today + 'T00:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const iso = cutoff.toISOString().slice(0, 10);
  try {
    const r = await db.run('UPDATE lh_attendance SET in_selfie = NULL, out_selfie = NULL WHERE date < ? AND (in_selfie IS NOT NULL OR out_selfie IS NOT NULL)', [iso]);
    if (r.changes) console.log(`[SELFIES] purged ${r.changes} record(s) older than ${days} days`);
  } catch (e) { console.error('[SELFIES] purge failed:', e.message); }
}

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
      totalWorkedMinutes += punchMinutes(r);
      daysWithOut++;
    }
  }

  let leaveDays = 0;
  for (const l of leaves) {
    if (l.status && l.status !== 'approved') continue;
    if (l.kind === 'wfh') continue; // work-from-home days are working days, not leave
    const start = new Date(String(l.from_date).slice(0, 10) + 'T00:00:00');
    const end = new Date(String(l.to_date).slice(0, 10) + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
    expectedMinutesSoFar: workdaysSoFar * hoursPerDay() * 60,
    expectedMinutesTotal: workdaysTotal * hoursPerDay() * 60
  };
}

class AttendanceService {
  async processClockIn(empId, { lat = null, lng = null, acc = null, addr = '', mode = 'office', selfie = '' } = {}) {
    const today = todayISO();
    const [existing, emp, open] = await Promise.all([attendanceModel.findByEmpAndDate(empId, today), employeeModel.findById(empId), attendanceModel.findOpenPunch(empId, yesterdayOf(today))]);

    if (open && open.date !== today) throw new AppError(`You are still clocked in from ${open.date} (${open.clock_in}). Clock out first.`, 400);
    if (existing && existing.clock_in && !existing.clock_out) throw new AppError('Already clocked in for today.', 400);
    if (existing && existing.clock_out) throw new AppError('Already completed attendance for today.', 400);
    const inSelfie = cleanSelfie(selfie, settingsService.get().selfieOnClockIn, 'clock in');
    purgeOldSelfies();

    if (!MODES.includes(mode)) mode = 'office';
    // An approved work-from-home request for today switches the punch to WFH mode
    const wfh = await db.get("SELECT id FROM lh_leaves WHERE emp = ? AND kind = 'wfh' AND from_date <= ? AND to_date >= ? AND (status = 'approved' OR status = '' OR status IS NULL) LIMIT 1", [empId, today, today]);
    if (wfh && mode === 'office') mode = 'wfh';

    const timeStr = nowHHMM();
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
      in_lat: lat, in_lng: lng, in_acc: acc, in_addr: addr || '',
      in_selfie: inSelfie
    });

    await activityModel.log(`${emp ? emp.name : 'Employee'} clocked in at ${timeStr}${late ? ' (late)' : ''}${mode === 'wfh' ? ' · work from home' : mode === 'field' ? ' · on field' : ''}${addr ? ' from ' + addr : ''}`);
    return record;
  }

  async processClockOut(empId, { lat = null, lng = null, acc = null, addr = '', selfie = '' } = {}) {
    const today = todayISO();
    // The open punch may be yesterday's: late-night shifts clock out after midnight
    const [existing, emp] = await Promise.all([attendanceModel.findOpenPunch(empId, yesterdayOf(today)), employeeModel.findById(empId)]);

    if (!existing || !existing.clock_in) {
      const todays = await attendanceModel.findByEmpAndDate(empId, today);
      if (todays && todays.clock_out) throw new AppError('Already clocked out today.', 400);
      throw new AppError('You have not clocked in yet today.', 400);
    }
    const outSelfie = cleanSelfie(selfie, settingsService.get().selfieOnClockOut, 'clock out');

    const timeStr = nowHHMM();
    const nextDay = existing.date !== today;
    const shift = emp ? emp.shift : 'day';
    // Overtime is automatic (when enabled): hours after the shift's OT threshold, counting past midnight
    const ot = settingsService.get().autoOvertime === false ? (Number(existing.ot_hours) || 0) : Math.max(Number(existing.ot_hours) || 0, otHoursFor(shift, timeStr, nextDay));
    const record = await attendanceModel.update(existing.id, { clock_out: timeStr, out_next_day: nextDay ? 1 : 0, ot_hours: ot, out_lat: lat, out_lng: lng, out_acc: acc, out_addr: addr || '', out_selfie: outSelfie });

    const workedMins = punchMinutes(record);
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
      expectedMinutesSoFar: staff.length * workdaysIn(month, true) * hoursPerDay() * 60,
      otHours: staff.reduce((a, s) => a + s.otHours, 0),
      lateCount: staff.reduce((a, s) => a + s.late, 0),
      staff
    };
  }
}

module.exports = new AttendanceService();
