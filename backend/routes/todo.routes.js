'use strict';

const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, todoController.getMyTodos);
router.post('/', protect, todoController.createTodo);
router.patch('/:id/toggle', protect, todoController.toggleTodo);
router.delete('/:id', protect, todoController.deleteTodo);

module.exports = router;
