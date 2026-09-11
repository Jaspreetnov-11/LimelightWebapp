'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class ProjectModel extends BaseModel {
  constructor() {
    super('lh_projects');
  }

  listWithConsumedMinutes() {
    return db.all(`
      SELECT p.*,
             COALESCE(SUM(t.mins), 0) as consumed_mins,
             COUNT(t.id) as task_count
      FROM lh_projects p
      LEFT JOIN lh_tasks t ON p.id = t.project
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
  }

  getProjectStats(projectId) {
    return db.get(`
      SELECT p.*,
             COALESCE(SUM(t.mins), 0) as consumed_mins,
             COUNT(t.id) as task_count,
             COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_task_count
      FROM lh_projects p
      LEFT JOIN lh_tasks t ON p.id = t.project
      WHERE p.id = ?
      GROUP BY p.id
    `, [projectId]);
  }
}

module.exports = new ProjectModel();
