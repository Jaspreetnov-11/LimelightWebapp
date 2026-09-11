'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class FileModel extends BaseModel {
  constructor() {
    super('lh_files');
  }

  async listWithDetails() {
    return db.all(`
      SELECT f.*, p.name as project_name, e.name as uploader_name
      FROM lh_files f
      LEFT JOIN lh_projects p ON f.project = p.id
      LEFT JOIN lh_employees e ON f.assigned_by = e.id
      ORDER BY f.created_at DESC
    `);
  }
}

module.exports = new FileModel();
