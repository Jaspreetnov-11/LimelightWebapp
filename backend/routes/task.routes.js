'use strict';

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createTaskSchema, updateTaskStatusSchema } = require('../validators/task.validator');

router.get('/', protect, taskController.getAllTasks);
router.post('/self', protect, taskController.createSelfTask);
router.get('/:id', protect, taskController.getTaskById);
router.post('/', protect, validate(createTaskSchema), taskController.createTask);
router.put('/:id', protect, taskController.updateTask);
router.post('/:id/reassign', protect, taskController.reassignTask);
router.post('/:id/reject', protect, taskController.rejectTask);
router.patch('/:id/status', protect, validate(updateTaskStatusSchema), taskController.updateTaskStatus);
router.delete('/:id', protect, taskController.deleteTask);

module.exports = router;
