'use strict';

const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', protect, settingsController.getSettings);
router.put('/', protect, restrictTo('admin'), settingsController.updateSettings);
router.post('/reset-data', protect, restrictTo('admin'), settingsController.resetData);

module.exports = router;
