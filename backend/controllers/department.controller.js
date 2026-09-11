'use strict';

const departmentModel = require('../models/department.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const getAllDepartments = catchAsync(async (req, res) => {
  const departments = await departmentModel.listWithStaffCount();
  return apiResponse.success(res, departments);
});

const createDepartment = catchAsync(async (req, res) => {
  const { name, billable = true, daily = 8, manager = '' } = req.body;
  const id = 'd_' + Math.random().toString(36).slice(2, 8);

  const dept = await departmentModel.create({
    id,
    name,
    billable: billable ? 1 : 0,
    daily: Number(daily) || 8,
    manager
  });

  return apiResponse.created(res, dept, 'Department created successfully');
});

const updateDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await departmentModel.findById(id);
  if (!existing) {
    throw new AppError('Department not found', 404);
  }

  const updateData = { ...req.body };
  if (updateData.billable !== undefined) {
    updateData.billable = updateData.billable ? 1 : 0;
  }

  const updated = await departmentModel.update(id, updateData);
  return apiResponse.success(res, updated, 'Department updated successfully');
});

const deleteDepartment = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await departmentModel.findById(id);
  if (!existing) {
    throw new AppError('Department not found', 404);
  }

  await departmentModel.delete(id);
  return apiResponse.success(res, null, 'Department deleted successfully');
});

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
