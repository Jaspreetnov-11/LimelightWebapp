// Shared formatting + calculation helpers (View helpers). Pure functions, no side effects.

// Task workflow: pipeline -> (accept) progress -> (submit) approval -> (approve) completed | (request) changes -> progress
export const STATUSES = ['pipeline', 'progress', 'approval', 'completed', 'changes'];
export const STATUS_LABEL = { pipeline: 'In Pipeline', progress: 'In Progress', approval: 'Pending Approval', completed: 'Completed', changes: 'Changes', hold: 'Changes' };
export const STATUS_CHIP = { completed: 'gr', progress: 'or', pipeline: 'bl', approval: 'pu', changes: 'pk', hold: 'pk' };
export const STATUS_COLOR = { completed: '#4ADE95', progress: '#FFB84D', pipeline: '#6FA8FF', approval: '#B48CFF', changes: '#FF7AB3', hold: '#FF7AB3' };
export const ATT = { present: ['P', 'Present', 'gr'], half: ['HD', 'Half Day', 'or'], absent: ['A', 'Absent', 'pk'], leave: ['L', 'Leave', 'bl'] };
export const PAY_TYPES = ['Salary', 'Advance', 'Bonus', 'Reimbursement', 'Fine'];
export const TASK_TYPES = ['Shoot', 'Edit', 'Design', 'Content', 'Social Media', 'Client Call', 'Other'];
export const SHIFTS = { day: 'Day · 11 am – 7 pm', evening: 'Evening · 2 pm – 10 pm' };
export const ACCESS_LABEL = { admin: 'Admin (full access)', manager: 'Team leader (projects + tasks)', staff: 'Staff (own work)' };
const AV = ['p', 'g', 'r', 'b', 'br', 'o', 't'];

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const thisMonth = () => todayISO().slice(0, 7);
export const monthKey = iso => (iso || '').slice(0, 7);
export const fmtD = iso => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');
export const fmtDY = iso => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const monthLabel = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const hm = mins => { mins = Math.round(mins || 0); return String(Math.floor(mins / 60)).padStart(2, '0') + 'h ' + String(mins % 60).padStart(2, '0') + 'm'; };
export const hrs1 = mins => (Math.round(((Number(mins) || 0) / 60) * 10) / 10) + 'h';
export const hhmm = d => { let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + m + ' ' + ap; };
export const nowHHMM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const ini = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
export const avFor = n => AV[[...String(n || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = n => INR.format(Math.round(Number(n) || 0));
export const minsBetween = (a, b) => { if (!a || !b) return 0; const [h1, m1] = a.split(':').map(Number); const [h2, m2] = b.split(':').map(Number); return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1)); };
export const overdue = t => t.status !== 'completed' && t.deadline && t.deadline < todayISO();
export const attStatus = a => (a ? (a.status || (a.clock_in ? 'present' : '')) : '');
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : a > 0 ? 100 : 0);
export const workdaysIn = (month, upToToday = true) => {
  const [y, mo] = month.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  const lim = upToToday && month === thisMonth() ? new Date().getDate() : last;
  let n = 0;
  for (let i = 1; i <= lim; i++) if (new Date(y, mo - 1, i).getDay() !== 0) n++;
  return n;
};
export const nextOccurrence = mmdd => { const y = new Date().getFullYear(); let d = new Date(y + '-' + mmdd + 'T00:00:00'); const t = new Date(todayISO() + 'T00:00:00'); if (d < t) d = new Date((y + 1) + '-' + mmdd + 'T00:00:00'); return d; };
export const daysUntil = d => Math.round((d - new Date(todayISO() + 'T00:00:00')) / 86400000);
export const whenLabel = d => { const n = daysUntil(d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); };
export const assigneeIds = t => String(t.assignee || '').split(',').map(s => s.trim()).filter(Boolean);
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Minutes taken on a task: stored when completed, live (since accept) while in progress. */
export const takenMins = (t, now = Date.now()) => {
  if (!t) return 0;
  if (t.status === 'completed') return Number(t.taken_mins) || 0;
  if (t.started_at) return Math.max(0, Math.round((now - new Date(t.started_at).getTime()) / 60000));
  return 0;
};
export const isRunning = t => Boolean(t && t.started_at && t.status !== 'completed');
