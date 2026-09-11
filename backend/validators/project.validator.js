'use strict';

const createProjectSchema = {
  name: {
    required: true,
    minLength: 2,
    message: 'Project name is required'
  },
  client: {
    required: false
  },
  alloc: {
    required: false,
    type: 'number',
    min: 0,
    message: 'Allocated minutes must be a positive number'
  }
};

module.exports = {
  createProjectSchema
};
