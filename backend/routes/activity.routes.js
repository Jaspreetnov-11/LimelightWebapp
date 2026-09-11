'use strict';

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, activityController.getActivities);
router.post('/read-all', protect, activityController.markAllRead);
router.get('/alerts', protect, activityController.getAlerts);
router.delete('/', protect, activityController.clearAll);
router.delete('/:id', protect, activityController.deleteOne);

module.exports = router;
