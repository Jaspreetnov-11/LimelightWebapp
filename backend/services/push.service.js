'use strict';
/**
 * Web push notifications (VAPID). Keys are generated once and kept in lh_settings under "vapid",
 * so every serverless instance shares them and no env var is needed. Subscriptions live in lh_push_subs.
 */
const webpush = require('web-push');
const db = require('../config/db');
const settingsModel = require('../models/settings.model');

const SUBJECT = 'mailto:admin@limelight.in';
let keys = null;
const newId = () => 'ps_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

async function getKeys() {
  if (keys) return keys;
  const all = await settingsModel.getAll();
  if (all.vapid && all.vapid.publicKey && all.vapid.privateKey) keys = all.vapid;
  else {
    keys = webpush.generateVAPIDKeys();
    await settingsModel.set('vapid', keys);
    console.log('[PUSH] generated VAPID keys');
  }
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

async function publicKey() { return (await getKeys()).publicKey; }

/** Save (or refresh) a browser subscription for an employee. */
async function subscribe(empId, sub, ua = '') {
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) throw new Error('Invalid push subscription');
  const existing = await db.get('SELECT id FROM lh_push_subs WHERE endpoint = ?', [sub.endpoint]);
  const keysJson = JSON.stringify(sub.keys);
  if (existing) await db.run('UPDATE lh_push_subs SET emp = ?, keys = ?, ua = ?, updated_at = ? WHERE id = ?', [empId, keysJson, String(ua).slice(0, 200), new Date().toISOString(), existing.id]);
  else await db.run('INSERT INTO lh_push_subs (id, emp, endpoint, keys, ua) VALUES (?, ?, ?, ?, ?)', [newId(), empId, sub.endpoint, keysJson, String(ua).slice(0, 200)]);
  return true;
}

async function unsubscribe(empId, endpoint) {
  if (!endpoint) return 0;
  const r = await db.run('DELETE FROM lh_push_subs WHERE endpoint = ? AND emp = ?', [endpoint, empId]);
  return r.changes || 0;
}

async function countFor(empId) {
  const row = await db.get('SELECT COUNT(*) AS n FROM lh_push_subs WHERE emp = ?', [empId]);
  return Number(row && row.n) || 0;
}

/**
 * Send a push to every device of the given employees. Never throws: failures are logged and
 * dead subscriptions (410 / 404) are removed. Awaited with a short cap so serverless responses are not held up.
 */
async function sendTo(empIds, { title = 'Lighthouse', body = '', url = '/notifications', tag = '' } = {}) {
  const ids = [...new Set((Array.isArray(empIds) ? empIds : [empIds]).filter(Boolean))];
  if (!ids.length) return { sent: 0 };
  try {
    await getKeys();
    const placeholders = ids.map(() => '?').join(',');
    const subs = await db.all(`SELECT * FROM lh_push_subs WHERE emp IN (${placeholders})`, ids);
    if (!subs.length) return { sent: 0 };
    const payload = JSON.stringify({ title, body: String(body).slice(0, 300), url, tag: tag || 'lh-' + Date.now() });
    let sent = 0;
    const work = subs.map(async s => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, payload, { TTL: 60 * 60 * 24, timeout: 4000 });
        sent++;
      } catch (e) {
        if (e && (e.statusCode === 410 || e.statusCode === 404)) await db.run('DELETE FROM lh_push_subs WHERE id = ?', [s.id]).catch(() => {});
        else console.error('[PUSH] send failed:', e && (e.body || e.message));
      }
    });
    await Promise.race([Promise.allSettled(work), new Promise(r => setTimeout(r, 6000))]);
    return { sent };
  } catch (e) { console.error('[PUSH] error:', e.message); return { sent: 0 }; }
}

module.exports = { publicKey, subscribe, unsubscribe, countFor, sendTo };
