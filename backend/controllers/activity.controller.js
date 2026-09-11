'use strict';

const activityModel = require('../models/activity.model');
const taskModel = require('../models/task.model');
const projectModel = require('../models/project.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const { todayISO } = require('../utils/calculations');

const getActivities = catchAsync(async (req, res) => {
  const { limit = 60 } = req.query;
  const activities = activityModel.getRecent(limit);
  const unreadCount = activityModel.getUnreadCount();

  return apiResponse.success(res, activities, 'Activities fetched', 200, {
    unreadCount
  });
});

const markAllRead = catchAsync(async (req, res) => {
  activityModel.markAllAsRead();
  return apiResponse.success(res, null, 'Marked all activities as read');
});

const getAlerts = catchAsync(async (req, res) => {
  const today = todayISO();
  const overdueTasks = taskModel.filterTasks({ overdueOnly: true, todayDate: today, limit: 100 });
  const allProjects = projectModel.listWithConsumedMinutes();
  const overshotProjects = allProjects.filter(p => Number(p.alloc) > 0 && Number(p.consumed_mins) > Number(p.alloc));

  return apiResponse.success(res, {
    totalAlerts: overdueTasks.length + overshotProjects.length,
    overdueTasks,
    overshotProjects
  });
});

module.exports = {
  getActivities,
  markAllRead,
  getAlerts
};
