'use strict';

const createDepartmentSchema = {
  name: {
    required: true,
    minLength: 2,
    message: 'Department name is required'
  },
  daily: {
    required: false,
    type: 'number',
    min: 1,
    max: 24,
    message: 'Daily hours must be between 1 and 24'
  }
};

module.exports = {
  createDepartmentSchema
};
