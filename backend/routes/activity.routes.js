'use strict';

const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', activityController.getActivities);
router.post('/read-all', protect, activityController.markAllRead);
router.get('/alerts', activityController.getAlerts);

module.exports = router;
