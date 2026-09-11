'use strict';

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, activityController.getActivities);
router.post('/read-all', protect, activityController.markAllRead);
router.get('/alerts', protect, activityController.getAlerts);

module.exports = router;
