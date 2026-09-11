'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class ActivityModel extends BaseModel {
  constructor() {
    super('lh_activity');
  }

  /** Fire-and-forget log line; never breaks the calling request. */
  async log(text) {
    try {
      await this.create({
        id: 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text,
        at: new Date().toISOString(),
        read: 0
      });
    } catch (err) {
      console.error('[ACTIVITY]', err.message);
    }
  }

  async getRecent(limit = 60) {
    return db.all('SELECT * FROM lh_activity ORDER BY created_at DESC LIMIT ?', [Number(limit)]);
  }

  async getUnreadCount() {
    const row = await db.get('SELECT COUNT(*) as count FROM lh_activity WHERE read = 0');
    return row ? Number(row.count) || 0 : 0;
  }

  async markAllAsRead() {
    await db.run('UPDATE lh_activity SET read = 1 WHERE read = 0');
    return true;
  }
}

module.exports = new ActivityModel();
