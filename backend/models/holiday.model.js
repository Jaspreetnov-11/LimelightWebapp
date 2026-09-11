'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class HolidayModel extends BaseModel {
  constructor() {
    super('lh_holidays');
  }

  getUpcoming(fromDate, limit = 10) {
    return db.all(
      'SELECT * FROM lh_holidays WHERE date >= ? ORDER BY date ASC LIMIT ?',
      [fromDate, Number(limit)]
    );
  }
}

module.exports = new HolidayModel();
