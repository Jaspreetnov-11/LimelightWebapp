'use strict';
/**
 * Google Slides builder. Uses a service account (GOOGLE_SERVICE_ACCOUNT_JSON) to create a deck,
 * optionally inside a shared Drive folder (GOOGLE_DRIVE_FOLDER_ID), then shares it and returns the link.
 * Brand look: black slides, white type, one yellow accent bar.
 */
const env = require('../../config/env');
const AppError = require('../../utils/appError');

const SCOPES = ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/drive'];
const INK = { red: 10 / 255, green: 10 / 255, blue: 11 / 255 };
const WHITE = { red: 1, green: 1, blue: 1 };
const MUTED = { red: 0.72, green: 0.72, blue: 0.76 };
const YELLOW = { red: 1, green: 210 / 255, blue: 31 / 255 };
const FONT = 'Montserrat';

function credentials() {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const c = JSON.parse(text);
    if (!c.client_email || !c.private_key) return null;
    return c;
  } catch (e) { return null; }
}
const ready = () => Boolean(credentials());

let jwt = null;
async function token() {
  const c = credentials();
  if (!c) throw new AppError('Google Slides is not connected. Add GOOGLE_SERVICE_ACCOUNT_JSON to .env.', 503);
  if (!jwt) { const { JWT } = require('google-auth-library'); jwt = new JWT({ email: c.client_email, key: c.private_key, scopes: SCOPES }); }
  const t = await jwt.getAccessToken();
  return t.token || (jwt.credentials && jwt.credentials.access_token);
}

async function call(url, method, body, tk) {
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError('Google ' + res.status + ': ' + ((data.error && data.error.message) || res.statusText), 502);
  return data;
}

const pt = (m) => ({ magnitude: m, unit: 'PT' });
const LAYOUT = { title: 'TITLE', section: 'SECTION_HEADER', bullets: 'TITLE_AND_BODY', two_column: 'TITLE_AND_TWO_COLUMNS', big_number: 'BIG_NUMBER', quote: 'MAIN_POINT', closing: 'TITLE' };

/** One slide -> createSlide + text + styling requests. Returns { requests, ids } */
function slideRequests(s, i) {
  const sid = 'sl_' + i, tid = 'ti_' + i, bid = 'bo_' + i, b2 = 'b2_' + i, bar = 'bar_' + i;
  const layout = LAYOUT[s.layout] || 'TITLE_AND_BODY';
  const maps = [];
  const texts = []; // [objectId, text, isTitle]
  if (layout === 'TITLE') {
    maps.push({ layoutPlaceholder: { type: 'CENTERED_TITLE', index: 0 }, objectId: tid }, { layoutPlaceholder: { type: 'SUBTITLE', index: 0 }, objectId: bid });
    texts.push([tid, s.title, true], [bid, s.subtitle || s.bullets.join('  ·  '), false]);
  } else if (layout === 'TITLE_AND_TWO_COLUMNS') {
    maps.push({ layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: tid }, { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bid }, { layoutPlaceholder: { type: 'BODY', index: 1 }, objectId: b2 });
    texts.push([tid, s.title, true], [bid, s.left.join('\n'), false], [b2, s.right.join('\n'), false]);
  } else if (layout === 'BIG_NUMBER') {
    maps.push({ layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: tid }, { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bid });
    texts.push([tid, s.number || s.title, true], [bid, s.caption || s.bullets.join('\n'), false]);
  } else if (layout === 'MAIN_POINT') {
    maps.push({ layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: tid });
    texts.push([tid, s.quote || s.title, true]);
  } else { // TITLE_AND_BODY, SECTION_HEADER
    maps.push({ layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: tid }, { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bid });
    texts.push([tid, s.title, true], [bid, layout === 'SECTION_HEADER' ? (s.subtitle || s.bullets.join('  ·  ')) : s.bullets.join('\n'), false]);
  }
  const requests = [{ createSlide: { objectId: sid, insertionIndex: i, slideLayoutReference: { predefinedLayout: layout }, placeholderIdMappings: maps } }];
  requests.push({ updatePageProperties: { objectId: sid, pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: INK } } } }, fields: 'pageBackgroundFill.solidFill.color' } });
  for (const [oid, text, isTitle] of texts) {
    if (!text) continue;
    requests.push({ insertText: { objectId: oid, insertionIndex: 0, text } });
    requests.push({ updateTextStyle: { objectId: oid, textRange: { type: 'ALL' }, style: { foregroundColor: { opaqueColor: { rgbColor: isTitle ? WHITE : MUTED } }, fontFamily: FONT, bold: isTitle }, fields: 'foregroundColor,fontFamily,bold' } });
    if (!isTitle && layout === 'TITLE_AND_BODY' && s.bullets.length > 1) requests.push({ createParagraphBullets: { objectId: oid, textRange: { type: 'ALL' }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
  }
  // the yellow spark: a short bar bottom-left
  requests.push({ createShape: { objectId: bar, shapeType: 'RECTANGLE', elementProperties: { pageObjectId: sid, size: { width: pt(54), height: pt(5) }, transform: { scaleX: 1, scaleY: 1, translateX: 36, translateY: 372, unit: 'PT' } } } });
  requests.push({ updateShapeProperties: { objectId: bar, shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: YELLOW } } }, outline: { propertyState: 'NOT_RENDERED' } }, fields: 'shapeBackgroundFill.solidFill.color,outline.propertyState' } });
  return { requests, sid };
}

/**
 * @param {object} deck   { title, slides: [{ layout, title, subtitle, bullets, left, right, number, caption, quote, notes }] }
 * @param {string} shareWith  email that gets edit access (the signed-in Lighthouse user)
 */
async function build(deck, shareWith) {
  const tk = await token();
  // 1. Create the file (inside the shared folder when configured so it lands in the team Drive)
  let id;
  if (env.GOOGLE_DRIVE_FOLDER_ID) {
    const f = await call('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', 'POST', { name: deck.title, mimeType: 'application/vnd.google-apps.presentation', parents: [env.GOOGLE_DRIVE_FOLDER_ID] }, tk);
    id = f.id;
  } else {
    const p = await call('https://slides.googleapis.com/v1/presentations', 'POST', { title: deck.title }, tk);
    id = p.presentationId;
  }
  const base = 'https://slides.googleapis.com/v1/presentations/' + id;
  const existing = await call(base, 'GET', null, tk);
  const defaults = (existing.slides || []).map(s => s.objectId);

  // 2. Slides, styling, then remove the blank default slide
  const requests = [];
  const ids = [];
  deck.slides.forEach((s, i) => { const r = slideRequests(s, i); requests.push(...r.requests); ids.push(r.sid); });
  defaults.forEach(oid => requests.push({ deleteObject: { objectId: oid } }));
  for (let i = 0; i < requests.length; i += 200) await call(base + ':batchUpdate', 'POST', { requests: requests.slice(i, i + 200) }, tk);

  // 3. Speaker notes (their object ids only exist after the slides do)
  const after = await call(base + '?fields=slides(objectId,slideProperties.notesPage.notesProperties.speakerNotesObjectId)', 'GET', null, tk);
  const notesReq = [];
  (after.slides || []).forEach(sl => {
    const k = ids.indexOf(sl.objectId);
    const notes = k >= 0 ? deck.slides[k].notes : '';
    const noid = sl.slideProperties && sl.slideProperties.notesPage && sl.slideProperties.notesPage.notesProperties && sl.slideProperties.notesPage.notesProperties.speakerNotesObjectId;
    if (notes && noid) notesReq.push({ insertText: { objectId: noid, insertionIndex: 0, text: notes } });
  });
  if (notesReq.length) await call(base + ':batchUpdate', 'POST', { requests: notesReq }, tk);

  // 4. Share: the requester can edit; anyone in Limelight with the link can view
  const perm = 'https://www.googleapis.com/drive/v3/files/' + id + '/permissions?supportsAllDrives=true&sendNotificationEmail=false';
  if (shareWith) await call(perm, 'POST', { role: 'writer', type: 'user', emailAddress: shareWith }, tk).catch(() => null);
  await call(perm, 'POST', { role: 'reader', type: 'anyone' }, tk).catch(() => null);

  return { id, url: 'https://docs.google.com/presentation/d/' + id + '/edit' };
}

module.exports = { ready, build };
