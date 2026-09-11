'use strict';

const holidayModel = require('../models/holiday.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { todayISO } = require('../utils/calculations');

const getAllHolidays = catchAsync(async (req, res) => {
  const { upcoming } = req.query;
  let holidays;
  if (upcoming === 'true') {
    holidays = await holidayModel.getUpcoming(todayISO(), 10);
  } else {
    holidays = await holidayModel.findAll({}, { orderBy: 'date ASC' });
  }
  return apiResponse.success(res, holidays);
});

const createHoliday = catchAsync(async (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) {
    throw new AppError('Holiday name and date are required', 400);
  }

  const id = 'h_' + Math.random().toString(36).slice(2, 8);
  const holiday = await holidayModel.create({ id, name, date });
  return apiResponse.created(res, holiday, 'Holiday created successfully');
});

const deleteHoliday = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await holidayModel.findById(id);
  if (!existing) {
    throw new AppError('Holiday not found', 404);
  }
  await holidayModel.delete(id);
  return apiResponse.success(res, null, 'Holiday deleted successfully');
});

module.exports = {
  getAllHolidays,
  createHoliday,
  deleteHoliday
};
