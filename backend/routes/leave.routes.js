'use strict';

const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { applyLeaveSchema } = require('../validators/leave.validator');

router.get('/', protect, leaveController.getAllLeaves);
router.get('/today', protect, leaveController.getLeavesToday);
router.post('/', protect, validate(applyLeaveSchema), leaveController.applyLeave);
router.patch('/:id/decide', protect, restrictTo('admin'), leaveController.decideLeave);
router.delete('/:id', protect, leaveController.deleteLeave);

module.exports = router;
