'use strict';

const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createEmployeeSchema, updateEmployeeSchema } = require('../validators/employee.validator');

router.get('/', employeeController.getAllEmployees);
router.get('/:id', employeeController.getEmployeeById);
router.post('/', protect, restrictTo('admin'), validate(createEmployeeSchema), employeeController.createEmployee);
router.put('/:id', protect, restrictTo('admin'), validate(updateEmployeeSchema), employeeController.updateEmployee);
router.delete('/:id', protect, restrictTo('admin'), employeeController.deleteEmployee);

module.exports = router;
