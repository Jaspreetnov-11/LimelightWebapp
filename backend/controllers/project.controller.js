'use strict';

const projectModel = require('../models/project.model');
const taskModel = require('../models/task.model');
const activityModel = require('../models/activity.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const getAllProjects = catchAsync(async (req, res) => {
  const projects = await projectModel.listWithConsumedMinutes();
  return apiResponse.success(res, projects);
});

const getProjectById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const project = await projectModel.getProjectStats(id);
  if (!project) throw new AppError('Project not found', 404);
  const tasks = await taskModel.filterTasks({ project: id, limit: 200 });
  return apiResponse.success(res, { ...project, tasks });
});

/** Admins and managers (team leaders) create projects; the creator becomes the team leader unless one is chosen. */
const createProject = catchAsync(async (req, res) => {
  const { name, client = '', billable = true, manager = '', start = todayISO(), alloc = 0, status = 'Approved' } = req.body;
  const id = 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const lead = manager || req.user.id;
  const proj = await projectModel.create({ id, name, client, billable: billable ? 1 : 0, manager: lead, start, alloc: Number(alloc) || 0, status });
  await activityModel.log(`${req.user.name} created project "${name}"`);
  if (lead !== req.user.id) await activityModel.notify(lead, `You are the team leader of "${name}"`, { kind: 'project', link: '/projects' });
  return apiResponse.created(res, proj, 'Project created successfully');
});

const updateProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) throw new AppError('Project not found', 404);
  if (req.user.role !== 'admin' && existing.manager !== req.user.id) throw new AppError('Only the team leader of this project can edit it.', 403);

  const updateData = { ...req.body };
  for (const k of ['id', 'consumed_mins', 'est_mins', 'task_count', 'completed_task_count', 'tasks']) delete updateData[k];
  if (updateData.billable !== undefined) updateData.billable = updateData.billable ? 1 : 0;
  if (updateData.alloc !== undefined) updateData.alloc = Number(updateData.alloc) || 0;
  const updated = await projectModel.update(id, updateData);
  if (updateData.manager && updateData.manager !== existing.manager) await activityModel.notify(updateData.manager, `You are now the team leader of "${updated.name}"`, { kind: 'project', link: '/projects' });
  return apiResponse.success(res, updated, 'Project updated successfully');
});

const deleteProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) throw new AppError('Project not found', 404);
  await projectModel.delete(id);
  return apiResponse.success(res, null, 'Project deleted successfully');
});

module.exports = { getAllProjects, getProjectById, createProject, updateProject, deleteProject };
