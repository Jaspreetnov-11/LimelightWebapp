'use strict';

const clockInSchema = {
  lat: {
    required: false,
    type: 'number',
    min: -90,
    max: 90,
    message: 'Latitude must be between -90 and 90'
  },
  lng: {
    required: false,
    type: 'number',
    min: -180,
    max: 180,
    message: 'Longitude must be between -180 and 180'
  },
  addr: {
    required: false
  },
  mode: {
    required: false,
    enum: ['office', 'wfh', 'field'],
    message: 'Mode must be office, wfh, or field'
  }
};

const clockOutSchema = {
  lat: {
    required: false,
    type: 'number',
    min: -90,
    max: 90
  },
  lng: {
    required: false,
    type: 'number',
    min: -180,
    max: 180
  },
  addr: {
    required: false
  }
};

const manualAttendanceSchema = {
  emp: {
    required: true,
    message: 'Employee ID is required'
  },
  date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Date must be formatted as YYYY-MM-DD'
  },
  status: {
    required: false,
    enum: ['present', 'half', 'absent', 'leave', ''],
    message: 'Status must be present, half, absent, or leave'
  }
};

module.exports = {
  clockInSchema,
  clockOutSchema,
  manualAttendanceSchema
};
