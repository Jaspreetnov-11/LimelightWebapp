'use strict';
/**
 * Productive hours per employee for a month, from task time rather than clock time.
 *
 *   own      – minutes spent on tasks assigned to the person (completed this month: taken_mins;
 *              still running: minutes since started_at)
 *   managed  – credit for whoever assigned the task: managerShare × task minutes + assignMins per task
 *              (operations / team leaders are working while their team's tasks are running)
 *   breaks   – break minutes taken this month (from attendance) come off the total
 *   productive = max(0, own + managed − breaks)
 */
const taskModel = require('../models/task.model');
const employeeModel = require('../models/employee.model');
const attendanceModel = require('../models/attendance.model');
const settingsService = require('./settings.service');
const { thisMonth, punchMinutes } = require('../utils/calculations');

const minsSince = iso => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

function taskMinutes(t) {
  if (t.status === 'completed') return Number(t.taken_mins) || 0;
  if (t.started_at && (t.status === 'progress' || t.status === 'approval' || t.status === 'changes')) return minsSince(t.started_at);
  return 0;
}

/** Does this task count in the given month? Completed tasks by completion date, running tasks by start date. */
function inMonth(t, month) {
  if (t.status === 'completed') return String(t.completed || '').slice(0, 7) === month;
  if (t.started_at) return String(t.started_at).slice(0, 7) === month || String(t.assigned || '').slice(0, 7) === month;
  return false;
}

async function computeMonth(month = thisMonth()) {
  const s = settingsService.get() || {};
  const share = Number(s.managerShare) || 0, assignMins = Number(s.assignMins) || 0;
  const [tasks, employees, rows] = await Promise.all([taskModel.findAll(), employeeModel.findAll({}, { orderBy: 'name ASC' }), attendanceModel.getMonthAttendanceAll(month)]);
  const byEmp = {};
  for (const e of employees) byEmp[e.id] = { id: e.id, name: e.name, dept: e.dept || '', role: e.role || '', ini: e.ini || '', av: e.av || '', ownMins: 0, managedMins: 0, breakMins: 0, clockMins: 0, tasksWorked: 0, tasksAssigned: 0, running: 0 };
  for (const t of tasks) {
    if (!inMonth(t, month)) continue;
    const mins = taskMinutes(t);
    const ids = String(t.assignee || '').split(',').map(x => x.trim()).filter(id => byEmp[id]);
    for (const id of ids) { byEmp[id].ownMins += mins / (ids.length || 1); byEmp[id].tasksWorked += 1; if (t.status !== 'completed' && t.started_at) byEmp[id].running += 1; }
    const by = t.assigned_by && byEmp[t.assigned_by];
    if (by && !ids.includes(t.assigned_by)) { by.managedMins += mins * share + assignMins; by.tasksAssigned += 1; }
  }
  for (const r of rows) { const e = byEmp[r.emp]; if (!e) continue; e.breakMins += Number(r.break_mins) || 0; if (r.clock_in && r.clock_out) e.clockMins += punchMinutes(r); }
  const list = Object.values(byEmp).map(e => {
    const own = Math.round(e.ownMins), managed = Math.round(e.managedMins);
    return { ...e, ownMins: own, managedMins: managed, productiveMins: Math.max(0, own + managed - e.breakMins) };
  }).sort((a, b) => b.productiveMins - a.productiveMins || a.name.localeCompare(b.name));
  const totals = list.reduce((a, e) => ({ productiveMins: a.productiveMins + e.productiveMins, clockMins: a.clockMins + e.clockMins, breakMins: a.breakMins + e.breakMins }), { productiveMins: 0, clockMins: 0, breakMins: 0 });
  return { month, managerShare: share, assignMins, totals, list };
}

module.exports = { computeMonth };
