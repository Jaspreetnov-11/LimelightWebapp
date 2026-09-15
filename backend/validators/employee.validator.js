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
  },
  emp_id: {
    required: false
  },
  password: {
    required: false,
    custom: (v) => !v || v.length >= 6 || 'Password must be at least 6 characters'
  }
};

const updateEmployeeSchema = {
  name: {
    required: false,
    minLength: 2
  },
  emp_id: {
    required: false
  },
  email: {
    required: false,
    custom: (v) => !v || emailRegex.test(v) || 'Invalid email format'
  },
  salary: {
    required: false,
    type: 'number',
    min: 0
  },
  password: {
    required: false,
    custom: (v) => !v || v.length >= 6 || 'Password must be at least 6 characters'
  }
};

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema
};
