'use strict';

const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createDepartmentSchema } = require('../validators/department.validator');

router.get('/', protect, departmentController.getAllDepartments);
router.post('/', protect, restrictTo('admin'), validate(createDepartmentSchema), departmentController.createDepartment);
router.put('/:id', protect, restrictTo('admin'), departmentController.updateDepartment);
router.delete('/:id', protect, restrictTo('admin'), departmentController.deleteDepartment);

module.exports = router;
