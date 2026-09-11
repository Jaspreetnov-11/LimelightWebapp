'use strict';

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createTaskSchema, updateTaskStatusSchema } = require('../validators/task.validator');

router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', protect, validate(createTaskSchema), taskController.createTask);
router.put('/:id', protect, taskController.updateTask);
router.patch('/:id/status', protect, validate(updateTaskStatusSchema), taskController.updateTaskStatus);
router.delete('/:id', protect, taskController.deleteTask);

module.exports = router;
