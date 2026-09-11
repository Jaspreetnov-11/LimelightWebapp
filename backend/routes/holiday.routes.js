'use strict';

const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holiday.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', holidayController.getAllHolidays);
router.post('/', protect, restrictTo('admin'), holidayController.createHoliday);
router.delete('/:id', protect, restrictTo('admin'), holidayController.deleteHoliday);

module.exports = router;
