'use strict';

const settingsService = require('../services/settings.service');
const activityModel = require('../models/activity.model');
const supabase = require('../config/supabase');
const db = require('../config/db');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const getSettings = catchAsync(async (req, res) => {
  const admin = req.user && req.user.role === 'admin';
  return apiResponse.success(res, admin ? settingsService.adminView() : settingsService.publicView());
});

const updateSettings = catchAsync(async (req, res) => {
  const out = await settingsService.update(req.body);
  await activityModel.log(`${req.user.name} updated workspace settings`);
  return apiResponse.success(res, out, 'Settings saved');
});

/**
 * Danger zone: wipe every record except admin accounts. Requires confirm: "RESET".
 * Removes staff (and their Supabase logins), departments, clients, projects, tasks,
 * attendance, leaves, payments, todos, files, holidays and notifications.
 */
const resetData = catchAsync(async (req, res) => {
  if (String(req.body.confirm || '') !== 'RESET') throw new AppError('Type RESET to confirm', 400);
  const admins = await db.all('SELECT id, email FROM lh_employees WHERE access = ?', ['admin']);
  const keep = admins.map(a => a.id);
  const staff = await db.all(keep.length ? `SELECT id, email FROM lh_employees WHERE id NOT IN (${keep.map(() => '?').join(',')})` : 'SELECT id, email FROM lh_employees', keep);
  const counts = {};
  for (const t of ['lh_tasks', 'lh_projects', 'lh_clients', 'lh_departments', 'lh_attendance', 'lh_leaves', 'lh_payments', 'lh_todos', 'lh_files', 'lh_holidays', 'lh_activity']) {
    counts[t.replace('lh_', '')] = (await db.run(`DELETE FROM ${t}`)).changes;
  }
  let removedStaff = 0, removedLogins = 0;
  for (const s of staff) {
    await db.run('DELETE FROM lh_employees WHERE id = ?', [s.id]); removedStaff++;
    if (req.body.deleteLogins) { try { if (await supabase.deleteUser(s.id)) removedLogins++; } catch (e) { /* ignore */ } }
  }
  counts.staff = removedStaff; counts.logins = removedLogins;
  await activityModel.log(`${req.user.name} reset the workspace data`);
  return apiResponse.success(res, counts, 'Workspace data cleared');
});

module.exports = { getSettings, updateSettings, resetData };
