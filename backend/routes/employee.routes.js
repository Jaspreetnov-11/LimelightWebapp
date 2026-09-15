'use strict';

const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createEmployeeSchema, updateEmployeeSchema } = require('../validators/employee.validator');

router.get('/', protect, employeeController.getAllEmployees);
router.get('/next-id', protect, employeeController.getNextEmpId);
router.get('/:id', protect, employeeController.getEmployeeById);
router.post('/', protect, restrictTo('admin'), validate(createEmployeeSchema), employeeController.createEmployee);
router.post('/import', protect, restrictTo('admin'), employeeController.importEmployees);
router.put('/:id', protect, restrictTo('admin'), validate(updateEmployeeSchema), employeeController.updateEmployee);
router.delete('/:id', protect, restrictTo('admin'), employeeController.deleteEmployee);

module.exports = router;
