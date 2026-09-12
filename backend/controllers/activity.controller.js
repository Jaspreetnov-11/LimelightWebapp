'use strict';

const activityModel = require('../models/activity.model');
const employeeModel = require('../models/employee.model');
const taskModel = require('../models/task.model');
const projectModel = require('../models/project.model');
const apiResponse = require('../utils/apiResponse');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { todayISO } = require('../utils/calculations');

const isAdmin = req => req.user && req.user.role === 'admin';

const getActivities = catchAsync(async (req, res) => {
  const { limit = 60 } = req.query;
  const [activities, unreadCount] = await Promise.all([
    activityModel.getRecentFor(req.user.id, isAdmin(req), limit),
    activityModel.getUnreadCountFor(req.user.id, isAdmin(req))
  ]);
  return apiResponse.success(res, activities, 'Activities fetched', 200, { unreadCount });
});

const markAllRead = catchAsync(async (req, res) => {
  await activityModel.markAllAsReadFor(req.user.id, isAdmin(req));
  return apiResponse.success(res, null, 'Marked all activities as read');
});

const deleteOne = catchAsync(async (req, res) => {
  const ok = await activityModel.deleteFor(req.params.id, req.user.id, isAdmin(req));
  if (!ok) throw new AppError('Notification not found', 404);
  return apiResponse.success(res, null, 'Notification removed');
});

/** Admin announcement: lands in everyone's notifications (optionally one department) and is pushed to their phones. */
const broadcast = catchAsync(async (req, res) => {
  if (!isAdmin(req)) throw new AppError('Only admins can send announcements.', 403);
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) throw new AppError('Write a message first.', 400);
  const dept = String(req.body.dept || '').trim();
  const all = await employeeModel.findAll(dept ? { dept } : {});
  const ids = all.filter(e => e.active === undefined || e.active === null || Number(e.active) !== 0).map(e => e.id);
  await activityModel.notify(ids, text, { kind: 'announcement', link: '/notifications', ref_type: 'announcement', title: 'Announcement · ' + req.user.name });
  return apiResponse.success(res, { recipients: ids.length }, 'Sent to ' + ids.length + ' people');
});

const clearAll = catchAsync(async (req, res) => {
  const n = await activityModel.clearFor(req.user.id, isAdmin(req));
  return apiResponse.success(res, { removed: n }, 'Notifications cleared');
});

/** Things that need attention: overdue tasks (own for staff, all for admins) and overshot projects. */
const getAlerts = catchAsync(async (req, res) => {
  const today = todayISO();
  const overdueTasks = await taskModel.filterTasks({ overdueOnly: true, todayDate: today, limit: 100, assignee: isAdmin(req) ? undefined : req.user.id });
  const allProjects = await projectModel.listWithConsumedMinutes();
  const overshotProjects = isAdmin(req)
    ? allProjects.filter(p => Number(p.alloc) > 0 && Number(p.consumed_mins) > Number(p.alloc))
    : allProjects.filter(p => p.manager === req.user.id && Number(p.alloc) > 0 && Number(p.consumed_mins) > Number(p.alloc));
  return apiResponse.success(res, { totalAlerts: overdueTasks.length + overshotProjects.length, overdueTasks, overshotProjects });
});

module.exports = { broadcast, getActivities, markAllRead, getAlerts, deleteOne, clearAll };
