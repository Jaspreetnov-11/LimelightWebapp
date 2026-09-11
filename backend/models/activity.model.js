'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class ActivityModel extends BaseModel {
  constructor() {
    super('lh_activity');
  }

  getRecent(limit = 60) {
    return db.all(
      'SELECT * FROM lh_activity ORDER BY created_at DESC LIMIT ?',
      [Number(limit)]
    );
  }

  getUnreadCount() {
    const row = db.get('SELECT COUNT(*) as count FROM lh_activity WHERE read = 0');
    return row ? row.count : 0;
  }

  markAllAsRead() {
    db.run('UPDATE lh_activity SET read = 1 WHERE read = 0');
    return true;
  }
}

module.exports = new ActivityModel();
