'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class ClientModel extends BaseModel {
  constructor() {
    super('lh_clients');
  }

  async listWithProjectCounts() {
    return db.all(`
      SELECT c.*, COUNT(p.id) as project_count
      FROM lh_clients c
      LEFT JOIN lh_projects p ON p.client_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
  }

  async findByName(name) {
    if (!name) return null;
    return db.get('SELECT * FROM lh_clients WHERE LOWER(name) = LOWER(?) LIMIT 1', [String(name).trim()]);
  }
}

module.exports = new ClientModel();
