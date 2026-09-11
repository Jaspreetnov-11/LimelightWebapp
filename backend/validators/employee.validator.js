'use strict';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createEmployeeSchema = {
  name: {
    required: true,
    minLength: 2,
    message: 'Staff name is required'
  },
  email: {
    required: false,
    custom: (v) => !v || emailRegex.test(v) || 'Invalid email format'
  },
  role: {
    required: false
  },
  dept: {
    required: false
  },
  salary: {
    required: false,
    type: 'number',
    min: 0,
    message: 'Salary must be a positive number'
  },
  phone: {
    required: false
  }
};

const updateEmployeeSchema = {
  name: {
    required: false,
    minLength: 2
  },
  email: {
    required: false,
    custom: (v) => !v || emailRegex.test(v) || 'Invalid email format'
  },
  salary: {
    required: false,
    type: 'number',
    min: 0
  }
};

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema
};
