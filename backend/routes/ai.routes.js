'use strict';
// AI Agent page: prompt studio, content writing (social + scripts), scheduling, ads. All signed-in staff.

const express = require('express');
const router = express.Router();
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { protect } = require('../middleware/auth.middleware');
const { provider } = require('../services/ai/llm');
const prompts = require('../services/ai/prompts.service');
const content = require('../services/ai/content.service');
const script = require('../services/ai/script.service');
const schedule = require('../services/ai/schedule.service');
const ads = require('../services/ai/ads.service');
const deck = require('../services/ai/deck.service');

const brief = req => {
  const b = String(req.body.brief || '').trim();
  if (!b) throw new AppError('Write a brief first.', 400);
  if (b.length > 4000) throw new AppError('Brief is too long (4000 characters max).', 400);
  return b;
};

// Everything the page needs to render its controls, plus which model will answer.
router.get('/meta', protect, (req, res) => apiResponse.success(res, {
  ...provider(),
  prompts: { targets: prompts.TARGETS, defaults: prompts.DEFAULT_TARGETS },
  content: { platforms: content.PLATFORMS, tones: content.TONES, langs: content.LANGS },
  script: { types: script.TYPES, durations: script.DURATIONS, tones: script.TONES, langs: script.LANGS },
  ads: { platforms: ads.PLATFORMS, objectives: ads.OBJECTIVES, langs: ads.LANGS },
  deck: { counts: deck.COUNTS, styles: deck.STYLES, langs: deck.LANGS, google: deck.googleReady() }
}));

router.post('/prompts', protect, catchAsync(async (req, res) => apiResponse.success(res, await prompts.write({ brief: brief(req), targets: req.body.targets }))));
router.post('/content', protect, catchAsync(async (req, res) => apiResponse.success(res, await content.write({ brief: brief(req), platforms: req.body.platforms, tone: req.body.tone, lang: req.body.lang, variants: req.body.variants }))));
router.post('/script', protect, catchAsync(async (req, res) => apiResponse.success(res, await script.write({ brief: brief(req), type: req.body.type, duration: req.body.duration, lang: req.body.lang, tone: req.body.tone, platform: req.body.platform }))));
router.post('/schedule', protect, catchAsync(async (req, res) => apiResponse.success(res, await schedule.build({ brief: brief(req), platforms: req.body.platforms, days: req.body.days, perWeek: req.body.perWeek, lang: req.body.lang, start: req.body.start }))));
router.post('/deck', protect, catchAsync(async (req, res) => apiResponse.success(res, await deck.make({ brief: brief(req), count: req.body.count, style: req.body.style, lang: req.body.lang, audience: req.body.audience, user: req.user }))));
router.post('/ads', protect, catchAsync(async (req, res) => apiResponse.success(res, await ads.write({ brief: brief(req), platforms: req.body.platforms, objective: req.body.objective, budget: req.body.budget, audience: req.body.audience, lang: req.body.lang }))));

module.exports = router;
