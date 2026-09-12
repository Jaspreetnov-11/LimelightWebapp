'use strict';
/**
 * Monthly performance score per employee, built from completed tasks.
 *
 *   points per task = 10 × type weight × timeliness × efficiency   (split equally between assignees)
 *
 *   type weight  – creative work counts more (Shoot / Edit / Design 1.5, Content 1.3, Social Media 1.0,
 *                  Client Call 0.8, Other 0.7). Admins can override via settings.taskWeights.
 *   timeliness   – delivered on/before the deadline ×1.5, up to 2 days late ×0.9, later ×0.6, no deadline ×1.0
 *   efficiency   – time taken vs the hours allocated to the task: well under ×1.25, under ×1.1,
 *                  slightly over ×1.0, over ×0.9, far over ×0.75 (×1.0 when nothing was tracked)
 */
const taskModel = require('../models/task.model');
const employeeModel = require('../models/employee.model');
const settingsService = require('./settings.service');
const db = require('../config/db');
const { thisMonth } = require('../utils/calculations');

const DEFAULT_WEIGHTS = { Shoot: 1.5, Edit: 1.5, Design: 1.5, Content: 1.3, 'Social Media': 1.0, 'Client Call': 0.8, Other: 0.7 };
const BASE = 10;

function weightsNow() {
  const s = settingsService.get() || {};
  return { ...DEFAULT_WEIGHTS, ...((s.taskWeights && typeof s.taskWeights === 'object') ? s.taskWeights : {}) };
}

const daysLate = (completed, deadline) => Math.round((new Date(completed + 'T00:00:00') - new Date(deadline + 'T00:00:00')) / 86400000);

function timelinessOf(t) {
  if (!t.deadline) return { f: 1.0, onTime: null };
  const late = daysLate(String(t.completed).slice(0, 10), String(t.deadline).slice(0, 10));
  if (late <= 0) return { f: 1.5, onTime: true };
  if (late <= 2) return { f: 0.9, onTime: false };
  return { f: 0.6, onTime: false };
}

function efficiencyOf(t) {
  const est = Number(t.mins) || 0, taken = Number(t.taken_mins) || 0;
  if (!est || !taken) return 1.0;
  const r = taken / est;
  if (r <= 0.75) return 1.25;
  if (r <= 1) return 1.1;
  if (r <= 1.25) return 1.0;
  if (r <= 1.5) return 0.9;
  return 0.75;
}

/** Score one task (before splitting between assignees). */
function scoreTask(t, weights) {
  const w = weights[t.type] !== undefined ? Number(weights[t.type]) : (weights.Other || 0.7);
  const tl = timelinessOf(t);
  const ef = efficiencyOf(t);
  return { points: BASE * w * tl.f * ef, weight: w, onTime: tl.onTime, efficiency: ef, creative: w >= 1.3 };
}

async function computeMonth(month = thisMonth()) {
  const weights = weightsNow();
  const [tasks, employees] = await Promise.all([taskModel.findAll(), employeeModel.findAll({}, { orderBy: 'name ASC' })]);
  const byEmp = {};
  for (const e of employees) byEmp[e.id] = { id: e.id, name: e.name, dept: e.dept || '', role: e.role || '', ini: e.ini || '', av: e.av || '', points: 0, tasks: 0, onTime: 0, withDeadline: 0, creative: 0, takenMins: 0, tracked: 0 };
  for (const t of tasks) {
    if (t.status !== 'completed' || String(t.completed || '').slice(0, 7) !== month) continue;
    const ids = String(t.assignee || '').split(',').map(s => s.trim()).filter(id => byEmp[id]);
    if (!ids.length) continue;
    const s = scoreTask(t, weights);
    for (const id of ids) {
      const e = byEmp[id];
      e.points += s.points / ids.length;
      e.tasks += 1;
      if (s.onTime !== null) { e.withDeadline += 1; if (s.onTime) e.onTime += 1; }
      if (s.creative) e.creative += 1;
      if (Number(t.taken_mins) > 0) { e.takenMins += Number(t.taken_mins); e.tracked += 1; }
    }
  }
  // Software half (50): task points scaled against the best scorer this month. Admin half (50): manual marks.
  const ratings = await db.all('SELECT emp, marks, note FROM lh_ratings WHERE month = ?', [month]).catch(() => []);
  const rated = Object.fromEntries(ratings.map(r => [r.emp, { marks: Math.min(50, Math.max(0, Number(r.marks) || 0)), note: r.note || '' }]));
  const maxPoints = Math.max(0, ...Object.values(byEmp).map(e => e.points));
  const list = Object.values(byEmp)
    .map(e => {
      const points = Math.round(e.points * 10) / 10;
      const auto = maxPoints > 0 ? Math.round((e.points / maxPoints) * 50 * 10) / 10 : 0;
      const r = rated[e.id];
      const adminMarks = r ? r.marks : null;
      const total = Math.round((auto + (adminMarks || 0)) * 10) / 10;
      return { ...e, points, auto, adminMarks, adminNote: r ? r.note : '', total, onTimePct: e.withDeadline ? Math.round((e.onTime / e.withDeadline) * 100) : null, avgTakenMins: e.tracked ? Math.round(e.takenMins / e.tracked) : 0 };
    })
    .sort((a, b) => b.total - a.total || b.auto - a.auto || b.tasks - a.tasks || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: e.total > 0 ? i + 1 : null }));
  return { month, base: BASE, weights, maxPoints: Math.round(maxPoints * 10) / 10, list };
}

/** Admin marks (0-50) for one person for a month. */
async function rate({ emp, month, marks, note = '', by = '' }) {
  const m = Math.min(50, Math.max(0, Number(marks) || 0));
  const existing = await db.get('SELECT id FROM lh_ratings WHERE emp = ? AND month = ?', [emp, month]);
  const now = new Date().toISOString();
  if (existing) await db.run('UPDATE lh_ratings SET marks = ?, note = ?, rated_by = ?, updated_at = ? WHERE id = ?', [m, String(note).slice(0, 300), by, now, existing.id]);
  else await db.run('INSERT INTO lh_ratings (id, emp, month, marks, note, rated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['r_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4), emp, month, m, String(note).slice(0, 300), by, now]);
  return { emp, month, marks: m, note };
}

module.exports = { computeMonth, rate, scoreTask, DEFAULT_WEIGHTS };
