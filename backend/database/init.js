'use strict';

/**
 * Database initialisation.
 *  - Postgres (Supabase): applies schema.pg.sql (idempotent). No demo data is seeded; real people
 *    come from Supabase Auth and appear in lh_employees on their first login or when an admin adds them.
 *  - SQLite (local fallback): applies schema.sql and seeds demo data when the database is empty.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const env = require('../config/env');

async function seedSqlite() {
  const { getSeedData } = require('./seed');
  const seed = getSeedData();
  const s = db.getSqlite();
  const ins = (sql, rows, pick) => {
    const stmt = s.prepare(sql);
    for (const r of rows) stmt.run(...pick(r));
  };
  ins('INSERT OR IGNORE INTO lh_departments (id, name, billable, daily, manager) VALUES (?, ?, ?, ?, ?)', seed.departments, d => [d.id, d.name, d.billable, d.daily, d.manager]);
  ins('INSERT OR IGNORE INTO lh_employees (id, name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, av, ini) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', seed.employees, e => [e.id, e.name, e.role, e.dept, e.email, e.phone, e.emp_id, e.joined, e.dob, e.managers, e.salary, e.access, e.av, e.ini]);
  ins('INSERT OR IGNORE INTO lh_projects (id, name, client, billable, manager, start, alloc, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', seed.projects, p => [p.id, p.name, p.client, p.billable, p.manager, p.start, p.alloc, p.status]);
  ins('INSERT OR IGNORE INTO lh_tasks (id, title, project, assignee, assigned_by, assigned, deadline, completed, status, mins, type, flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', seed.tasks, t => [t.id, t.title, t.project, t.assignee, t.assigned_by, t.assigned, t.deadline, t.completed, t.status, t.mins, t.type, t.flag]);
  ins('INSERT OR IGNORE INTO lh_attendance (id, emp, date, clock_in, clock_out, mode, status, ot_hours, fine_hours, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', seed.attendance, a => [a.id, a.emp, a.date, a.clock_in, a.clock_out, a.mode, a.status, a.ot_hours, a.fine_hours, a.note]);
  ins('INSERT OR IGNORE INTO lh_leaves (id, emp, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)', seed.leaves, l => [l.id, l.emp, l.from_date, l.to_date, l.reason, l.status]);
  ins('INSERT OR IGNORE INTO lh_payments (id, emp, date, amount, type, note, assigned_by) VALUES (?, ?, ?, ?, ?, ?, ?)', seed.payments, p => [p.id, p.emp, p.date, p.amount, p.type, p.note, p.assigned_by]);
  ins('INSERT OR IGNORE INTO lh_holidays (id, name, date) VALUES (?, ?, ?)', seed.holidays || [], h => [h.id, h.name, h.date]);
  ins('INSERT OR IGNORE INTO lh_activity (id, text, at, read) VALUES (?, ?, ?, ?)', seed.activity || [], a => [a.id, a.text, a.at, a.read]);
}

async function initDatabase() {
  if (db.isPostgres) {
    const sql = fs.readFileSync(path.resolve(__dirname, 'schema.pg.sql'), 'utf8');
    await db.exec(sql);
    return 'postgres';
  }

  const sql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  await db.exec(sql);
  const row = await db.get('SELECT COUNT(*) as count FROM lh_employees');
  if (!row || Number(row.count) === 0) await seedSqlite();
  return 'sqlite:' + env.DATABASE_PATH;
}

module.exports = { initDatabase };
