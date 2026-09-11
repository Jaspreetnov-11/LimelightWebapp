'use strict';

const BaseModel = require('./base.model');
const db = require('../config/db');

class TaskModel extends BaseModel {
  constructor() {
    super('lh_tasks');
  }

  filterTasks({ assignee, project, status, overdueOnly, todayDate, limit = 500, offset = 0 } = {}) {
    let sql = `
      SELECT t.*,
             p.name as project_name,
             e.name as assignee_name,
             e.role as assignee_role,
             e.av as assignee_av,
             e.ini as assignee_ini
      FROM lh_tasks t
      LEFT JOIN lh_projects p ON t.project = p.id
      LEFT JOIN lh_employees e ON t.assignee = e.id
      WHERE 1=1
    `;
    const params = [];

    if (assignee) {
      sql += ` AND (t.assignee = ? OR t.assignee LIKE ? OR t.assignee LIKE ? OR t.assignee LIKE ?)`;
      params.push(assignee, `${assignee},%`, `%,${assignee}`, `%,${assignee},%`);
    }
    if (project) {
      sql += ` AND t.project = ?`;
      params.push(project);
    }
    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }
    if (overdueOnly && todayDate) {
      sql += ` AND t.status != 'completed' AND t.deadline IS NOT NULL AND t.deadline < ?`;
      params.push(todayDate);
    }

    sql += ` ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END, t.deadline ASC, t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    return db.all(sql, params);
  }

  getStatusCounts(assignee = null) {
    let sql = `SELECT status, COUNT(*) as count FROM lh_tasks`;
    const params = [];
    if (assignee) {
      sql += ` WHERE (assignee = ? OR assignee LIKE ? OR assignee LIKE ? OR assignee LIKE ?)`;
      params.push(assignee, `${assignee},%`, `%,${assignee}`, `%,${assignee},%`);
    }
    sql += ` GROUP BY status`;
    return db.all(sql, params);
  }
}

module.exports = new TaskModel();
