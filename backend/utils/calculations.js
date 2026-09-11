'use strict';

/**
 * Shared Payroll, Attendance & Time calculations
 * DRY principle: single source of truth for business calculations across backend modules.
 */

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);

const minsBetween = (inTime, outTime) => {
  if (!inTime || !outTime) return 0;
  const [h1, m1] = inTime.split(':').map(Number);
  const [h2, m2] = outTime.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
};

const workdaysIn = (month, upToToday = true) => {
  if (!month) month = thisMonth();
  const [y, mo] = month.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  const isCurrentMonth = month === thisMonth();
  const limit = (upToToday && isCurrentMonth) ? new Date().getDate() : last;

  let count = 0;
  for (let d = 1; d <= limit; d++) {
    // 0 = Sunday, 1-6 = Monday to Saturday (Limelight work week)
    if (new Date(y, mo - 1, d).getDay() !== 0) {
      count++;
    }
  }
  return count;
};

const calculateEarnedSalary = (salary, workdaysFull, presentDays, halfDays, leaveDays, otHours = 0, fineHours = 0) => {
  const sal = Number(salary) || 0;
  if (sal <= 0) return 0;

  const fullDays = Math.max(1, workdaysFull);
  const perDay = sal / fullDays;
  const perHour = perDay / 8;

  const earned = perDay * (presentDays + (0.5 * halfDays) + leaveDays) +
                 (perHour * otHours) -
                 (perHour * fineHours);

  return Math.max(0, Math.round(earned));
};

const formatINR = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Math.round(val || 0));
};

module.exports = {
  todayISO,
  thisMonth,
  minsBetween,
  workdaysIn,
  calculateEarnedSalary,
  formatINR
};
