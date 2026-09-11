'use strict';

const activityModel = require('../models/activity.model');
const taskModel = require('../models/task.model');
const projectModel = require('../models/project.model');
const apiResponse = require('../utils/apiResponse');
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

module.exports = { getActivities, markAllRead, getAlerts };
