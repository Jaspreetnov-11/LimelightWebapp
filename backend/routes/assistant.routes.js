'use strict';

const express = require('express');
const router = express.Router();
const assistant = require('../services/assistant.service');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { protect } = require('../middleware/auth.middleware');

// Ask Simran. Body: { messages: [{ role: 'user'|'assistant', text }] }
router.post('/chat', protect, catchAsync(async (req, res) => {
  const history = Array.isArray(req.body.messages) ? req.body.messages.filter(m => m && typeof m.text === 'string').slice(-20) : [];
  if (!history.length) throw new AppError('Write a message first.', 400);
  return apiResponse.success(res, await assistant.chat(req.user, history));
}));

// Send a message to the admin's WhatsApp (server-side when configured, else returns a wa.me link)
router.post('/whatsapp', protect, catchAsync(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw new AppError('Write a message first.', 400);
  const r = await assistant.toWhatsApp(req.user, text);
  return apiResponse.success(res, r, r.sent ? 'Sent on WhatsApp' : r.reason || 'Opening WhatsApp');
}));

module.exports = router;
