'use strict';

const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createProjectSchema } = require('../validators/project.validator');

router.get('/', protect, projectController.getAllProjects);
router.get('/:id', protect, projectController.getProjectById);
router.post('/', protect, restrictTo('admin', 'manager'), validate(createProjectSchema), projectController.createProject);
router.put('/:id', protect, restrictTo('admin', 'manager'), projectController.updateProject);
router.delete('/:id', protect, restrictTo('admin'), projectController.deleteProject);

module.exports = router;
