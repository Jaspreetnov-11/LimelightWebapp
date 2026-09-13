'use strict';
// AI Agent page: prompt studio, content writing (social + scripts), scheduling, ads, PPT.
// Every generation is saved per staff member (lh_ai_runs); uploaded reference files are read
// into text (lh_ai_refs) and can be attached to any brief. Any run can be exported as a PDF.

const express = require('express');
const fs = require('fs');
const router = express.Router();
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const { provider } = require('../services/ai/llm');
const prompts = require('../services/ai/prompts.service');
const content = require('../services/ai/content.service');
const script = require('../services/ai/script.service');
const schedule = require('../services/ai/schedule.service');
const ads = require('../services/ai/ads.service');
const deck = require('../services/ai/deck.service');
const refsSvc = require('../services/ai/refs');
const pdf = require('../services/ai/pdf');
const store = require('../models/ai.model');

const TOOLS = ['prompts', 'content', 'script', 'schedule', 'ads', 'deck'];
const isAdmin = u => (u.role || u.access) === 'admin';

const brief = req => {
  const b = String(req.body.brief || '').trim();
  if (!b) throw new AppError('Write a brief first.', 400);
  if (b.length > 4000) throw new AppError('Brief is too long (4000 characters max).', 400);
  return b;
};

/** Text block from the reference ids the client attached. */
async function context(req) {
  const ids = Array.isArray(req.body.refs) ? req.body.refs.filter(x => typeof x === 'string').slice(0, 6) : [];
  if (!ids.length) return '';
  const rows = await store.refs.texts(ids, req.user.id, isAdmin(req.user));
  return refsSvc.contextBlock(rows);
}

/** Save a run and return the payload with its id attached. */
async function save(req, tool, title, input, result) {
  const runId = await store.runs.create({ emp: req.user.id, tool, title, input, output: result, provider: result.provider || '' });
  return { ...result, runId };
}

// ---------------------------------------------------------------- meta
router.get('/meta', protect, (req, res) => apiResponse.success(res, {
  ...provider(),
  prompts: { targets: prompts.TARGETS, defaults: prompts.DEFAULT_TARGETS },
  content: { platforms: content.PLATFORMS, tones: content.TONES, langs: content.LANGS },
  script: { types: script.TYPES, durations: script.DURATIONS, tones: script.TONES, langs: script.LANGS },
  ads: { platforms: ads.PLATFORMS, objectives: ads.OBJECTIVES, langs: ads.LANGS },
  deck: { counts: deck.COUNTS, styles: deck.STYLES, langs: deck.LANGS, google: deck.googleReady() },
  admin: isAdmin(req.user)
}));

// ---------------------------------------------------------------- generations (each saved)
router.post('/prompts', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, targets: req.body.targets, refs: req.body.refs };
  const r = await prompts.write({ brief: b, targets: req.body.targets, context: await context(req) });
  return apiResponse.success(res, await save(req, 'prompts', r.pack.concept || b, input, r));
}));

router.post('/content', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, platforms: req.body.platforms, tone: req.body.tone, lang: req.body.lang, variants: req.body.variants, refs: req.body.refs };
  const r = await content.write({ ...input, context: await context(req) });
  return apiResponse.success(res, await save(req, 'content', r.pack.angle || b, input, r));
}));

router.post('/script', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, type: req.body.type, duration: req.body.duration, lang: req.body.lang, tone: req.body.tone, platform: req.body.platform, refs: req.body.refs };
  const r = await script.write({ ...input, context: await context(req) });
  return apiResponse.success(res, await save(req, 'script', r.script.title || b, input, r));
}));

router.post('/schedule', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, platforms: req.body.platforms, days: req.body.days, perWeek: req.body.perWeek, lang: req.body.lang, start: req.body.start, refs: req.body.refs };
  const r = await schedule.build({ ...input, context: await context(req) });
  return apiResponse.success(res, await save(req, 'schedule', r.plan.campaign || b, input, r));
}));

router.post('/ads', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, platforms: req.body.platforms, objective: req.body.objective, budget: req.body.budget, audience: req.body.audience, lang: req.body.lang, refs: req.body.refs };
  const r = await ads.write({ ...input, context: await context(req) });
  return apiResponse.success(res, await save(req, 'ads', b, input, r));
}));

router.post('/deck', protect, catchAsync(async (req, res) => {
  const b = brief(req), input = { brief: b, count: req.body.count, style: req.body.style, lang: req.body.lang, audience: req.body.audience, refs: req.body.refs };
  const r = await deck.outline({ ...input, context: await context(req) });
  return apiResponse.success(res, r); // the outline is a draft; the approved deck is what gets saved
}));

router.post('/deck/design', protect, catchAsync(async (req, res) => {
  if (!req.body.outline || typeof req.body.outline !== 'object') throw new AppError('Approve an outline first.', 400);
  const r = await deck.design({ outline: req.body.outline, user: req.user });
  const { pptx, ...toStore } = r; // the .pptx bytes are not stored; the deck spec is, and can be re-rendered
  return apiResponse.success(res, { ...await save(req, 'deck', r.deck.title, { brief: req.body.outline.brief, outline: req.body.outline }, toStore), pptx });
}));

// ---------------------------------------------------------------- reference files
router.get('/references', protect, catchAsync(async (req, res) => apiResponse.success(res, await store.refs.list(req.user.id))));

router.post('/references', protect, upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded.', 400);
  try {
    const { text, kind } = await refsSvc.extract(req.file);
    const row = await store.refs.create({ emp: req.user.id, name: req.file.originalname, kind, text });
    return apiResponse.created(res, row, 'Reference added');
  } finally {
    fs.unlink(req.file.path, () => {}); // the text is what we keep; the upload itself is not needed
  }
}));

router.delete('/references/:id', protect, catchAsync(async (req, res) => {
  const ok = await store.refs.remove(req.params.id, req.user.id, isAdmin(req.user));
  if (!ok) throw new AppError('Reference not found.', 404);
  return apiResponse.success(res, null, 'Reference removed');
}));

// ---------------------------------------------------------------- history (per staff; admins see everyone)
router.get('/history', protect, catchAsync(async (req, res) => {
  const tool = TOOLS.includes(req.query.tool) ? req.query.tool : '';
  let emp = req.user.id;
  if (isAdmin(req.user)) emp = req.query.staff === 'all' ? '' : (req.query.staff || req.user.id);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  return apiResponse.success(res, await store.runs.list({ emp, tool, limit, offset }));
}));

async function loadRun(req) {
  const run = await store.runs.get(req.params.id);
  if (!run || (!isAdmin(req.user) && run.emp !== req.user.id)) throw new AppError('Not found.', 404);
  return run;
}

router.get('/history/:id', protect, catchAsync(async (req, res) => {
  const run = await loadRun(req);
  return apiResponse.success(res, { ...run, doc: pdf.docFor(run.tool, run.input, run.output) });
}));

router.get('/history/:id/pdf', protect, catchAsync(async (req, res) => {
  const run = await loadRun(req);
  const doc = pdf.docFor(run.tool, run.input, run.output);
  const buf = await pdf.render(doc, { by: run.emp_name, date: run.created_at });
  const name = (doc.title || run.tool).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || run.tool;
  return apiResponse.success(res, { filename: name + '.pdf', base64: buf.toString('base64') });
}));

router.get('/history/:id/pptx', protect, catchAsync(async (req, res) => {
  const run = await loadRun(req);
  if (run.tool !== 'deck' || !run.output.deck) throw new AppError('Not a deck.', 400);
  const buf = await require('../services/ai/pptx').build(run.output.deck);
  const name = (run.output.deck.title || 'deck').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60) || 'deck';
  return apiResponse.success(res, { filename: name + '.pptx', base64: buf.toString('base64') });
}));

router.delete('/history/:id', protect, catchAsync(async (req, res) => {
  await loadRun(req);
  await store.runs.remove(req.params.id);
  return apiResponse.success(res, null, 'Deleted');
}));

module.exports = router;
