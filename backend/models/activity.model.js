'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');
const push = require('../services/push.service');

const newId = () => 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Activity = notifications.
 *  user_id ''  -> team-wide log line (visible to admins)
 *  user_id X   -> personal notification for employee X (e.g. "task assigned to you")
 */
class ActivityModel extends BaseModel {
  constructor() {
    super('lh_activity');
  }

  /** Team-wide log line; never breaks the calling request. */
  async log(text, opts = {}) {
    try {
      await this.create({ id: newId(), text, at: new Date().toISOString(), read: 0, user_id: opts.user_id || '', kind: opts.kind || 'info', link: opts.link || '', ref_type: opts.ref_type || '', ref_id: opts.ref_id || '' });
    } catch (err) {
      console.error('[ACTIVITY]', err.message);
    }
  }

  /** Personal notification to one or more employees. */
  async notify(userIds, text, opts = {}) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
    for (const id of ids) await this.log(text, { ...opts, user_id: id, kind: opts.kind || 'task' });
    // Web push to every subscribed device of those people (best effort)
    if (ids.length && opts.push !== false) await push.sendTo(ids, { title: opts.title || 'Lighthouse', body: text, url: opts.link || '/notifications', tag: opts.ref_id ? String(opts.ref_type || 'n') + '-' + opts.ref_id : '' });
  }

  scopeSql(userId, isAdmin) {
    return isAdmin ? { sql: "(user_id = ? OR user_id = '')", params: [userId] } : { sql: 'user_id = ?', params: [userId] };
  }

  async getRecentFor(userId, isAdmin, limit = 60) {
    const s = this.scopeSql(userId, isAdmin);
    return db.all(`SELECT * FROM lh_activity WHERE ${s.sql} ORDER BY created_at DESC LIMIT ?`, [...s.params, Number(limit)]);
  }

  async getUnreadCountFor(userId, isAdmin) {
    const s = this.scopeSql(userId, isAdmin);
    const row = await db.get(`SELECT COUNT(*) as count FROM lh_activity WHERE read = 0 AND ${s.sql}`, s.params);
    return row ? Number(row.count) || 0 : 0;
  }

  /** Delete one notification if it is in the caller's scope. */
  async deleteFor(id, userId, isAdmin) {
    const s = this.scopeSql(userId, isAdmin);
    const r = await db.run(`DELETE FROM lh_activity WHERE id = ? AND ${s.sql}`, [id, ...s.params]);
    return r.changes > 0;
  }

  /** Delete every notification in the caller's scope. */
  async clearFor(userId, isAdmin) {
    const s = this.scopeSql(userId, isAdmin);
    const r = await db.run(`DELETE FROM lh_activity WHERE ${s.sql}`, s.params);
    return r.changes;
  }

  async markAllAsReadFor(userId, isAdmin) {
    const s = this.scopeSql(userId, isAdmin);
    await db.run(`UPDATE lh_activity SET read = 1 WHERE read = 0 AND ${s.sql}`, s.params);
    return true;
  }
}

module.exports = new ActivityModel();
