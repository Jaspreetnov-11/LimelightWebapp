'use strict';

const projectModel = require('../models/project.model');
const taskModel = require('../models/task.model');
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
  if (!project) {
    throw new AppError('Project not found', 404);
  }

  const tasks = await taskModel.filterTasks({ project: id, limit: 200 });
  return apiResponse.success(res, { ...project, tasks });
});

const createProject = catchAsync(async (req, res) => {
  const { name, client = '', billable = true, manager = '', start = todayISO(), alloc = 0, status = 'Approved' } = req.body;
  const id = 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  const proj = await projectModel.create({
    id,
    name,
    client,
    billable: billable ? 1 : 0,
    manager,
    start,
    alloc: Number(alloc) || 0,
    status
  });

  return apiResponse.created(res, proj, 'Project created successfully');
});

const updateProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) {
    throw new AppError('Project not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.billable !== undefined) {
    updateData.billable = updateData.billable ? 1 : 0;
  }
  if (updateData.alloc !== undefined) {
    updateData.alloc = Number(updateData.alloc) || 0;
  }

  const updated = await projectModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Project updated successfully');
});

const deleteProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) {
    throw new AppError('Project not found', 404);
  }

  await projectModel.delete(id);
  return apiResponse.success(res, null, 'Project deleted successfully');
});

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};
