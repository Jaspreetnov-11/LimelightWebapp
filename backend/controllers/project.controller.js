'use strict';

const projectModel = require('../models/project.model');
const clientModel = require('../models/client.model');
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
/** Resolve the client dropdown: returns { client_id, client (display name), billable } */
async function resolveClient(body, fallbackBillable) {
  const out = {};
  if (body.client_id !== undefined) {
    if (body.client_id) {
      const c = await clientModel.findById(body.client_id);
      if (!c) throw new AppError('Client not found', 404);
      out.client_id = c.id; out.client = c.name;
      if (body.billable === undefined) out.billable = c.billing === 'non-billable' ? 0 : 1;
    } else { out.client_id = ''; if (body.client !== undefined) out.client = String(body.client || ''); }
  } else if (body.client !== undefined) out.client = String(body.client || '');
  if (body.billable !== undefined) out.billable = body.billable ? 1 : 0;
  else if (out.billable === undefined && fallbackBillable !== undefined) out.billable = fallbackBillable ? 1 : 0;
  if (body.fee !== undefined) out.fee = Math.max(0, Number(body.fee) || 0);
  return out;
}

const splitIds = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

const createProject = catchAsync(async (req, res) => {
  const { name, manager = '', start = todayISO(), alloc = 0, status = 'Approved' } = req.body;
  const id = 'p_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const mgrIds = splitIds(manager);
  const lead = mgrIds.length ? mgrIds.join(',') : req.user.id;
  const cl = await resolveClient(req.body, true);
  const proj = await projectModel.create({ id, name, client: '', client_id: '', fee: 0, billable: 1, ...cl, manager: lead, start, alloc: Number(alloc) || 0, status });
  await activityModel.log(`${req.user.name} created project "${name}"`);
  const notifyLeads = splitIds(lead).filter(x => x !== req.user.id);
  if (notifyLeads.length) await activityModel.notify(notifyLeads, `You are a team leader of "${name}"`, { kind: 'project', link: '/projects?project=' + id, ref_type: 'project', ref_id: id });
  return apiResponse.created(res, proj, 'Project created successfully');
});

const updateProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) throw new AppError('Project not found', 404);
  const currentLeads = splitIds(existing.manager);
  if (req.user.role !== 'admin' && !currentLeads.includes(req.user.id)) throw new AppError('Only the team leader of this project can edit it.', 403);

  const updateData = { ...req.body, ...(await resolveClient(req.body)) };
  for (const k of ['id', 'consumed_mins', 'est_mins', 'task_count', 'completed_task_count', 'tasks']) delete updateData[k];
  if (updateData.billable !== undefined) updateData.billable = updateData.billable ? 1 : 0;
  if (updateData.alloc !== undefined) updateData.alloc = Number(updateData.alloc) || 0;
  if (updateData.manager !== undefined) {
    const mgrIds = splitIds(updateData.manager);
    updateData.manager = mgrIds.join(',');
    const oldSet = new Set(currentLeads);
    const addedLeads = mgrIds.filter(x => !oldSet.has(x) && x !== req.user.id);
    if (addedLeads.length) await activityModel.notify(addedLeads, `You are now a team leader of "${existing.name}"`, { kind: 'project', link: '/projects?project=' + id, ref_type: 'project', ref_id: id });
  }
  const updated = await projectModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Project updated successfully');
});

const deleteProject = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await projectModel.findById(id);
  if (!existing) throw new AppError('Project not found', 404);
  const currentLeads = splitIds(existing.manager);
  if (req.user.role !== 'admin' && !currentLeads.includes(req.user.id)) throw new AppError('Only the team leader of this project can delete it.', 403);
  await projectModel.delete(id);
  return apiResponse.success(res, null, 'Project deleted successfully');
});

module.exports = { getAllProjects, getProjectById, createProject, updateProject, deleteProject };
