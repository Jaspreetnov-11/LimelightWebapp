'use strict';

const todoModel = require('../models/todo.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const getMyTodos = catchAsync(async (req, res) => {
  const ownerId = req.user.employeeId || req.user.id;
  const todos = todoModel.getUserTodos(ownerId);
  return apiResponse.success(res, todos);
});

const createTodo = catchAsync(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    throw new AppError('Todo text is required', 400);
  }

  const ownerId = req.user.employeeId || req.user.id;
  const id = 'td_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  const todo = todoModel.create({
    id,
    text: text.trim(),
    done: 0,
    owner: ownerId
  });

  return apiResponse.created(res, todo, 'To-do added');
});

const toggleTodo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const ownerId = req.user.employeeId || req.user.id;

  const toggled = todoModel.toggle(id, ownerId);
  if (!toggled) {
    throw new AppError('Todo not found or not owned by you', 404);
  }

  return apiResponse.success(res, toggled, 'To-do updated');
});

const deleteTodo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const ownerId = req.user.employeeId || req.user.id;

  const existing = todoModel.findOne({ id, owner: ownerId });
  if (!existing) {
    throw new AppError('Todo not found or not owned by you', 404);
  }

  todoModel.delete(id);
  return apiResponse.success(res, null, 'To-do removed');
});

module.exports = {
  getMyTodos,
  createTodo,
  toggleTodo,
  deleteTodo
};
