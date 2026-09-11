'use strict';

const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { applyLeaveSchema } = require('../validators/leave.validator');

router.get('/', leaveController.getAllLeaves);
router.get('/today', leaveController.getLeavesToday);
router.post('/', protect, validate(applyLeaveSchema), leaveController.applyLeave);
router.delete('/:id', protect, leaveController.deleteLeave);

module.exports = router;
