'use strict';

const createTaskSchema = {
  title: {
    required: true,
    minLength: 2,
    message: 'Task title is required'
  },
  project: {
    required: false
  },
  assignee: {
    required: false
  },
  deadline: {
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    message: 'Deadline must be formatted as YYYY-MM-DD'
  },
  status: {
    required: false,
    enum: ['pipeline', 'progress', 'approval', 'completed', 'hold'],
    message: 'Status must be one of: pipeline, progress, approval, completed, hold'
  },
  mins: {
    required: false,
    type: 'number',
    min: 0,
    message: 'Minutes must be a positive number'
  }
};

const updateTaskStatusSchema = {
  status: {
    required: true,
    enum: ['pipeline', 'progress', 'approval', 'completed', 'hold'],
    message: 'Status must be one of: pipeline, progress, approval, completed, hold'
  }
};

module.exports = {
  createTaskSchema,
  updateTaskStatusSchema
};
