'use strict';

const express = require('express');
const router = express.Router();
const push = require('../services/push.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { protect } = require('../middleware/auth.middleware');

// Public VAPID key the browser needs to subscribe
router.get('/key', protect, catchAsync(async (req, res) => apiResponse.success(res, { publicKey: await push.publicKey() })));

// Status for this user: how many devices are subscribed
router.get('/status', protect, catchAsync(async (req, res) => apiResponse.success(res, { devices: await push.countFor(req.user.id) })));

router.post('/subscribe', protect, catchAsync(async (req, res) => {
  const sub = req.body.subscription || req.body;
  try { await push.subscribe(req.user.id, sub, req.headers['user-agent'] || ''); } catch (e) { throw new AppError(e.message, 400); }
  return apiResponse.success(res, { devices: await push.countFor(req.user.id) }, 'Push notifications enabled on this device');
}));

router.post('/unsubscribe', protect, catchAsync(async (req, res) => {
  const removed = await push.unsubscribe(req.user.id, req.body.endpoint);
  return apiResponse.success(res, { removed }, 'Push notifications turned off on this device');
}));

// Send a test push to the caller's own devices
router.post('/test', protect, catchAsync(async (req, res) => {
  const r = await push.sendTo(req.user.id, { title: 'Lighthouse', body: 'Push notifications are working on this device.', url: '/notifications', tag: 'lh-test' });
  return apiResponse.success(res, r, r.sent ? 'Test notification sent' : 'No subscribed device found. Enable push first.');
}));

module.exports = router;
