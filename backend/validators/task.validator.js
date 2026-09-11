'use strict';

const STATUSES = ['pipeline', 'progress', 'approval', 'completed', 'changes'];

const createTaskSchema = {
  title: { required: true, minLength: 2, message: 'Task title is required' },
  project: { required: true, message: 'Select a project first' },
  dept: { required: true, message: 'Department is required' },
  assignee: { required: true, message: 'Assign the task to at least one person' },
  type: { required: true, message: 'Task type is required' },
  status: { required: true, enum: STATUSES, message: 'Status must be one of: ' + STATUSES.join(', ') },
  deadline: { required: true, pattern: /^\d{4}-\d{2}-\d{2}$/, message: 'Deadline must be formatted as YYYY-MM-DD' },
  mins: { required: false, type: 'number', min: 0, message: 'Estimated minutes must be a positive number' }
};

const updateTaskStatusSchema = {
  status: { required: true, enum: STATUSES, message: 'Status must be one of: ' + STATUSES.join(', ') }
};

module.exports = { STATUSES, createTaskSchema, updateTaskStatusSchema };
