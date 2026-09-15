'use strict';

const express = require('express');
const router = express.Router();
const salarySlipController = require('../controllers/salarySlip.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', protect, salarySlipController.getEmployeeSlips);
router.get('/:empId', protect, salarySlipController.getEmployeeSlips);
router.post('/generate', protect, restrictTo('admin'), salarySlipController.generateSlip);
router.put('/:id', protect, restrictTo('admin'), salarySlipController.updateSlip);
router.delete('/:id', protect, restrictTo('admin'), salarySlipController.deleteSlip);

module.exports = router;
