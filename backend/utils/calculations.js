'use strict';

/**
 * Shared payroll, attendance, shift and time calculations.
 * Work rules (shifts, grace, hours per day) are configurable from Settings -> Admin controls;
 * settings.service calls configure() at start-up and after every change.
 */

const APP_TZ = process.env.APP_TZ || 'Asia/Kolkata';

// ---- configurable work rules (mutated in place by configure so existing imports stay live)
const SHIFTS = {
  day: { label: 'Day (11 am – 7 pm)', start: '11:00', end: '19:00', otAfter: '20:00' },
  evening: { label: 'Evening (2 pm – 10 pm)', start: '14:00', end: '22:00', otAfter: '23:00' }
};
const cfg = { graceMins: 20, hoursPerDay: 8, otRate: 1, weekOff: [0] }; // weekOff: 0 = Sunday

function configure(next = {}) {
  if (next.shifts) {
    for (const k of Object.keys(SHIFTS)) delete SHIFTS[k];
    for (const [k, v] of Object.entries(next.shifts)) SHIFTS[k] = { ...v };
  }
  if (next.graceMins !== undefined) cfg.graceMins = Math.max(0, Number(next.graceMins) || 0);
  if (next.hoursPerDay !== undefined) cfg.hoursPerDay = Math.max(1, Number(next.hoursPerDay) || 8);
  if (next.otRate !== undefined) cfg.otRate = Math.max(0, Number(next.otRate) || 1);
  if (Array.isArray(next.weekOff)) cfg.weekOff = next.weekOff.map(Number).filter(n => n >= 0 && n <= 6);
}
const graceMins = () => cfg.graceMins;
const hoursPerDay = () => cfg.hoursPerDay;
const otRate = () => cfg.otRate;
const weekOff = () => cfg.weekOff;

const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const nowParts = (d = new Date()) => {
  const p = {};
  for (const x of partsFmt.formatToParts(d)) p[x.type] = x.value;
  return { y: p.year, m: p.month, d: p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
};
const todayISO = () => { const p = nowParts(); return `${p.y}-${p.m}-${p.d}`; };
const nowHHMM = () => { const p = nowParts(); return `${p.hh}:${p.mm}`; };
const thisMonth = () => todayISO().slice(0, 7);

const toMins = hhmm => {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const minsBetween = (inTime, outTime) => {
  const a = toMins(inTime), b = toMins(outTime);
  if (a === null || b === null) return 0;
  return Math.max(0, b - a);
};

const shiftOf = key => SHIFTS[key] || SHIFTS[Object.keys(SHIFTS)[0]] || { label: 'Day', start: '11:00', end: '19:00', otAfter: '20:00' };

/** True when the clock-in is later than shift start + grace. */
const isLate = (shiftKey, clockIn) => {
  const s = shiftOf(shiftKey);
  const t = toMins(clockIn);
  return t !== null && t > toMins(s.start) + cfg.graceMins;
};

/** Overtime hours for a clock-out, counted only after the shift's OT threshold (2 decimals). */
const otHoursFor = (shiftKey, clockOut) => {
  const s = shiftOf(shiftKey);
  const t = toMins(clockOut);
  if (t === null) return 0;
  const extra = t - toMins(s.otAfter);
  return extra > 0 ? Math.round((extra / 60) * 100) / 100 : 0;
};

const workdaysIn = (month, upToToday = true) => {
  if (!month) month = thisMonth();
  const [y, mo] = month.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  const isCurrentMonth = month === thisMonth();
  const limit = (upToToday && isCurrentMonth) ? Number(todayISO().slice(8, 10)) : last;
  let count = 0;
  for (let d = 1; d <= limit; d++) {
    if (!cfg.weekOff.includes(new Date(y, mo - 1, d).getDay())) count++;
  }
  return count;
};

/** Earned = per-day × (present + half/2 + leave) + OT × hourly × rate − fine × hourly. */
const calculateEarnedSalary = (salary, workdaysFull, presentDays, halfDays, leaveDays, otHours = 0, fineHours = 0) => {
  const sal = Number(salary) || 0;
  if (sal <= 0) return 0;
  const fullDays = Math.max(1, workdaysFull);
  const perDay = sal / fullDays;
  const perHour = perDay / cfg.hoursPerDay;
  const earned = perDay * (presentDays + (0.5 * halfDays) + leaveDays) + (perHour * otHours * cfg.otRate) - (perHour * fineHours);
  return Math.max(0, Math.round(earned));
};

const formatINR = val => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(val || 0));

module.exports = {
  APP_TZ,
  SHIFTS,
  configure,
  graceMins,
  hoursPerDay,
  otRate,
  weekOff,
  nowParts,
  nowHHMM,
  todayISO,
  thisMonth,
  toMins,
  minsBetween,
  shiftOf,
  isLate,
  otHoursFor,
  workdaysIn,
  calculateEarnedSalary,
  formatINR
};
