'use strict';

const clientModel = require('../models/client.model');
const projectModel = require('../models/project.model');
const activityModel = require('../models/activity.model');
const pnlService = require('../services/pnl.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { thisMonth } = require('../utils/calculations');
const db = require('../config/db');

const BILLING = ['billable', 'non-billable'];
const clean = body => {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.contact_name !== undefined) out.contact_name = String(body.contact_name || '').trim();
  if (body.phone !== undefined) out.phone = String(body.phone || '').trim();
  if (body.email !== undefined) out.email = String(body.email || '').trim().toLowerCase();
  if (body.billing !== undefined) out.billing = BILLING.includes(body.billing) ? body.billing : 'billable';
  if (body.retainer !== undefined) out.retainer = Math.max(0, Number(body.retainer) || 0);
  if (body.notes !== undefined) out.notes = String(body.notes || '');
  if (body.active !== undefined) out.active = body.active ? 1 : 0;
  return out;
};

/** Admin: every client with this month's revenue / cost / profit. Managers: names only. */
const getAllClients = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin') {
    const list = await clientModel.findAll({}, { orderBy: 'name ASC' });
    return apiResponse.success(res, list.map(c => ({ id: c.id, name: c.name, billing: c.billing, active: c.active })));
  }
  const { month = thisMonth() } = req.query;
  const pnl = await pnlService.monthly(month);
  return apiResponse.success(res, pnl.clients, 'Clients fetched', 200, { month: pnl.month, totals: pnl.totals, workdays: pnl.workdays });
});

const getClientById = catchAsync(async (req, res) => {
  const { month = thisMonth() } = req.query;
  const pnl = await pnlService.monthly(month);
  const c = pnl.clients.find(x => x.id === req.params.id);
  if (!c) throw new AppError('Client not found', 404);
  return apiResponse.success(res, c);
});

const createClient = catchAsync(async (req, res) => {
  const data = clean(req.body);
  if (!data.name) throw new AppError('Client name is required', 400);
  if (await clientModel.findByName(data.name)) throw new AppError('A client with this name already exists', 409);
  const id = 'c_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const client = await clientModel.create({ id, billing: 'billable', retainer: 0, active: 1, ...data });
  await activityModel.log(`${req.user.name} added client "${client.name}"`);
  return apiResponse.created(res, client, 'Client added');
});

const updateClient = catchAsync(async (req, res) => {
  const existing = await clientModel.findById(req.params.id);
  if (!existing) throw new AppError('Client not found', 404);
  const data = clean(req.body);
  if (data.name && data.name.toLowerCase() !== String(existing.name).toLowerCase()) {
    const dup = await clientModel.findByName(data.name);
    if (dup && dup.id !== existing.id) throw new AppError('A client with this name already exists', 409);
  }
  const updated = await clientModel.update(existing.id, data);
  // keep the display name / billing on projects in sync
  if (data.name || data.billing) {
    await db.run('UPDATE lh_projects SET client = ?, updated_at = ? WHERE client_id = ?', [updated.name, new Date().toISOString(), updated.id]);
  }
  return apiResponse.success(res, updated, 'Client updated');
});

const deleteClient = catchAsync(async (req, res) => {
  const existing = await clientModel.findById(req.params.id);
  if (!existing) throw new AppError('Client not found', 404);
  const n = await projectModel.count({ client_id: existing.id });
  if (n > 0) throw new AppError(`This client still has ${n} project(s). Move or delete them first.`, 400);
  await clientModel.delete(existing.id);
  return apiResponse.success(res, null, 'Client removed');
});

module.exports = { getAllClients, getClientById, createClient, updateClient, deleteClient };
