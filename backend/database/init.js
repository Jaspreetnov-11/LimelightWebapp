'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { getSeedData } = require('./seed');

function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema
  db.exec(schemaSql);

  // Check if seeding is needed
  const empCount = db.get('SELECT COUNT(*) as count FROM lh_employees');
  if (!empCount || empCount.count === 0) {
    const seed = getSeedData();

    // Insert departments
    const insertDept = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_departments (id, name, billable, daily, manager) VALUES (?, ?, ?, ?, ?)'
    );
    for (const d of seed.departments) {
      insertDept.run(d.id, d.name, d.billable, d.daily, d.manager);
    }

    // Insert employees
    const insertEmp = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_employees (id, name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, av, ini) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const e of seed.employees) {
      insertEmp.run(e.id, e.name, e.role, e.dept, e.email, e.phone, e.emp_id, e.joined, e.dob, e.managers, e.salary, e.access, e.av, e.ini);
    }

    // Insert users (auth)
    const insertUser = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_users (id, email, password_hash, role, employee_id) VALUES (?, ?, ?, ?, ?)'
    );
    for (const u of seed.users) {
      insertUser.run(u.id, u.email, u.password_hash, u.role, u.employee_id);
    }

    // Insert projects
    const insertProj = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_projects (id, name, client, billable, manager, start, alloc, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const p of seed.projects) {
      insertProj.run(p.id, p.name, p.client, p.billable, p.manager, p.start, p.alloc, p.status);
    }

    // Insert tasks
    const insertTask = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_tasks (id, title, project, assignee, assigned_by, assigned, deadline, completed, status, mins, type, flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const t of seed.tasks) {
      insertTask.run(t.id, t.title, t.project, t.assignee, t.assigned_by, t.assigned, t.deadline, t.completed, t.status, t.mins, t.type, t.flag);
    }

    // Insert attendance
    const insertAtt = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_attendance (id, emp, date, clock_in, clock_out, mode, status, ot_hours, fine_hours, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const a of seed.attendance) {
      insertAtt.run(a.id, a.emp, a.date, a.clock_in, a.clock_out, a.mode, a.status, a.ot_hours, a.fine_hours, a.note);
    }

    // Insert leaves
    const insertLeave = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_leaves (id, emp, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const l of seed.leaves) {
      insertLeave.run(l.id, l.emp, l.from_date, l.to_date, l.reason, l.status);
    }

    // Insert payments
    const insertPay = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_payments (id, emp, date, amount, type, note, assigned_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const p of seed.payments) {
      insertPay.run(p.id, p.emp, p.date, p.amount, p.type, p.note, p.assigned_by);
    }

    // Insert holidays
    const insertHol = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_holidays (id, name, date) VALUES (?, ?, ?)'
    );
    for (const h of seed.holidays) {
      insertHol.run(h.id, h.name, h.date);
    }

    // Insert activity
    const insertAct = db.getSqlite().prepare(
      'INSERT OR IGNORE INTO lh_activity (id, text, at, read) VALUES (?, ?, ?, ?)'
    );
    for (const ac of seed.activity) {
      insertAct.run(ac.id, ac.text, ac.at, ac.read);
    }
  }
}

module.exports = { initDatabase };
