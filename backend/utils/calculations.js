'use strict';

/**
 * Shared payroll, attendance, shift and time calculations.
 * Single source of truth for business rules across backend modules.
 */

// All "wall clock" values (today, clock-in time, shifts) are in the company timezone,
// regardless of where the server runs (Vercel functions run in UTC).
const APP_TZ = process.env.APP_TZ || 'Asia/Kolkata';
const partsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const nowParts = (d = new Date()) => {
  const p = {};
  for (const x of partsFmt.formatToParts(d)) p[x.type] = x.value;
  return { y: p.year, m: p.month, d: p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
};
const todayISO = () => { const p = nowParts(); return `${p.y}-${p.m}-${p.d}`; };
const nowHHMM = () => { const p = nowParts(); return `${p.hh}:${p.mm}`; };
const thisMonth = () => todayISO().slice(0, 7);

// Shifts (24h clock). OT is counted only after `otAfter`, paid at 1x of the hourly rate.
const SHIFTS = {
  day: { label: 'Day (11 am – 7 pm)', start: '11:00', end: '19:00', otAfter: '20:00' },
  evening: { label: 'Evening (2 pm – 10 pm)', start: '14:00', end: '22:00', otAfter: '23:00' }
};
const GRACE_MINS = 20;
const HOURS_PER_DAY = 8;

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

const shiftOf = key => SHIFTS[key] || SHIFTS.day;

/** True when the clock-in is later than shift start + grace. */
const isLate = (shiftKey, clockIn) => {
  const s = shiftOf(shiftKey);
  const t = toMins(clockIn);
  return t !== null && t > toMins(s.start) + GRACE_MINS;
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
    if (new Date(y, mo - 1, d).getDay() !== 0) count++; // Mon–Sat work week
  }
  return count;
};

/** Earned = per-day × (present + half/2 + leave) + OT × hourly (1x) − fine × hourly. */
const calculateEarnedSalary = (salary, workdaysFull, presentDays, halfDays, leaveDays, otHours = 0, fineHours = 0) => {
  const sal = Number(salary) || 0;
  if (sal <= 0) return 0;
  const fullDays = Math.max(1, workdaysFull);
  const perDay = sal / fullDays;
  const perHour = perDay / HOURS_PER_DAY;
  const earned = perDay * (presentDays + (0.5 * halfDays) + leaveDays) + (perHour * otHours) - (perHour * fineHours);
  return Math.max(0, Math.round(earned));
};

const formatINR = val => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(val || 0));

module.exports = {
  APP_TZ,
  nowParts,
  nowHHMM,
  todayISO,
  thisMonth,
  SHIFTS,
  GRACE_MINS,
  HOURS_PER_DAY,
  toMins,
  minsBetween,
  shiftOf,
  isLate,
  otHoursFor,
  workdaysIn,
  calculateEarnedSalary,
  formatINR
};
