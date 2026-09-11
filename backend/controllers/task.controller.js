'use strict';

const taskModel = require('../models/task.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const getAllTasks = catchAsync(async (req, res) => {
  const { assignee, project, status, overdueOnly, page = 1, limit = 500 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const tasks = await taskModel.filterTasks({
    assignee,
    project,
    status,
    overdueOnly: overdueOnly === 'true' || overdueOnly === true,
    todayDate: todayISO(),
    limit,
    offset
  });

  const total = await taskModel.count();
  const statusCounts = await taskModel.getStatusCounts(assignee);

  return apiResponse.success(res, tasks, 'Tasks fetched successfully', 200, {
    total,
    statusCounts
  });
});

const getTaskById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const task = await taskModel.findById(id);
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  return apiResponse.success(res, task);
});

const createTask = catchAsync(async (req, res) => {
  const { title, project = '', assignee = '', assigned = todayISO(), deadline = null, mins = 0, type = 'Other', flag = false, status = 'pipeline' } = req.body;
  const id = 't_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const assignedBy = req.user ? (req.user.employeeId || req.user.id) : '';

  const task = await taskModel.create({
    id,
    title,
    project,
    assignee,
    assigned_by: assignedBy,
    assigned,
    deadline,
    completed: status === 'completed' ? todayISO() : null,
    status,
    mins: Number(mins) || 0,
    type,
    flag: flag ? 1 : 0
  });

  return apiResponse.created(res, task, 'Task created successfully');
});

const updateTask = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await taskModel.findById(id);
  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.status === 'completed' && existing.status !== 'completed') {
    updateData.completed = todayISO();
  } else if (updateData.status && updateData.status !== 'completed') {
    updateData.completed = null;
  }
  if (updateData.flag !== undefined) {
    updateData.flag = updateData.flag ? 1 : 0;
  }
  if (updateData.mins !== undefined) {
    updateData.mins = Number(updateData.mins) || 0;
  }

  const updated = await taskModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Task updated successfully');
});

const updateTaskStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const existing = await taskModel.findById(id);
  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  const updateData = { status };
  if (status === 'completed') {
    updateData.completed = todayISO();
  } else {
    updateData.completed = null;
  }

  const updated = await taskModel.update(id, updateData);
  return apiResponse.success(res, updated, `Task moved to ${status}`);
});

const deleteTask = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await taskModel.findById(id);
  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  await taskModel.delete(id);
  return apiResponse.success(res, null, 'Task deleted successfully');
});

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask
};
