'use strict';

/**
 * One-time migration of the old Supabase app data into the lh_* tables used by this backend.
 *
 *   node backend/database/migrate-supabase.js
 *
 * - Existing lh_* tables with the old (typed) layout are renamed to old_lh_* (nothing is deleted).
 * - profiles            -> lh_employees   (id = Supabase Auth user id)
 * - attendance_sessions -> lh_attendance  (slug -> profile id, times in Asia/Kolkata)
 * - leave_requests      -> lh_leaves
 * - old lh_departments  -> lh_departments (names kept)
 * Idempotent: rows that already exist are left alone.
 */

require('dotenv').config();
const db = require('../config/db');
const env = require('../config/env');
const { initDatabase } = require('./init');

const initialsOf = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || 'LM';
const AV = ['o', 'p', 'g', 'r', 'b', 'br', 't'];
const avFor = id => AV[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const isAdmin = email => env.ADMIN_EMAILS.includes(String(email || '').toLowerCase());
const now = () => new Date().toISOString();

async function tableExists(name) {
  const r = await db.get("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?", [name]);
  return Boolean(r);
}

async function columnType(table, column) {
  const r = await db.get("SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?", [table, column]);
  return r ? r.data_type : null;
}

async function main() {
  if (!db.isPostgres) throw new Error('DATABASE_URL is not set; nothing to migrate.');

  // 1. Park old-layout lh_* tables (typed columns from the earlier schema) under old_lh_*
  const tables = ['lh_employees', 'lh_departments', 'lh_projects', 'lh_tasks', 'lh_attendance', 'lh_leaves', 'lh_payments', 'lh_holidays', 'lh_todos', 'lh_files', 'lh_activity'];
  const oldLayout = (await tableExists('lh_employees')) && (await columnType('lh_employees', 'created_at')) !== 'text';
  if (oldLayout) {
    for (const t of tables) {
      if (await tableExists(t)) {
        if (await tableExists('old_' + t)) await db.exec(`DROP TABLE public.old_${t}`);
        await db.exec(`ALTER TABLE public.${t} RENAME TO old_${t}`);
        console.log('renamed', t, '-> old_' + t);
      }
    }
  }

  // 2. Fresh schema
  await initDatabase();
  console.log('schema ready');

  // 3. Departments: keep names from the old table, plus the ones used by profiles
  const deptNames = new Set();
  if (await tableExists('old_lh_departments')) {
    for (const d of await db.all('SELECT name FROM old_lh_departments')) deptNames.add(d.name);
  }
  if (await tableExists('profiles')) {
    for (const p of await db.all("SELECT DISTINCT dept FROM profiles WHERE dept IS NOT NULL AND dept <> ''")) deptNames.add(p.dept);
  }
  let d = 0;
  for (const name of deptNames) {
    const exists = await db.get('SELECT id FROM lh_departments WHERE name = ?', [name]);
    if (exists) continue;
    await db.run('INSERT INTO lh_departments (id, name, billable, daily, manager, created_at, updated_at) VALUES (?, ?, 1, 8, ?, ?, ?)', ['d_' + Math.random().toString(36).slice(2, 8), name, '', now(), now()]);
    d++;
  }
  console.log('departments added:', d);

  // 4. Employees from profiles (id = Auth user id)
  const profiles = await tableExists('profiles')
    ? await db.all("SELECT p.id, p.slug, p.name, p.title, p.dept, COALESCE(NULLIF(p.email,''), u.email) AS email, p.active, p.created_at::text AS created_at FROM profiles p LEFT JOIN auth.users u ON u.id = p.id ORDER BY p.created_at")
    : [];
  const slugToId = {};
  let e = 0;
  for (const p of profiles) {
    slugToId[p.slug] = p.id;
    const exists = await db.get('SELECT id FROM lh_employees WHERE id = ?', [p.id]);
    if (exists) continue;
    const empId = await require('../models/employee.model').nextEmpId();
    await db.run(
      'INSERT INTO lh_employees (id, name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, av, ini, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.name || (p.email || '').split('@')[0], (p.title || '').trim(), p.dept || 'Operations', (p.email || '').toLowerCase(), '', empId,
        String(p.created_at || now()).slice(0, 10), null, '[]', 0, isAdmin(p.email) ? 'admin' : 'staff', avFor(p.id), initialsOf(p.name), p.active === false ? 0 : 1, now(), now()]
    );
    e++;
  }
  // Auth users that have no profile row
  const orphans = await db.all("SELECT u.id, u.email, u.raw_user_meta_data AS meta FROM auth.users u LEFT JOIN lh_employees e ON e.id = u.id::text WHERE e.id IS NULL");
  for (const u of orphans) {
    const meta = u.meta || {};
    const name = meta.name || meta.full_name || String(u.email).split('@')[0];
    await db.run(
      'INSERT INTO lh_employees (id, name, role, dept, email, phone, emp_id, joined, dob, managers, salary, access, av, ini, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [u.id, name, meta.title || '', meta.dept || 'Operations', String(u.email).toLowerCase(), '', await require('../models/employee.model').nextEmpId(), now().slice(0, 10), null, '[]', 0, isAdmin(u.email) ? 'admin' : 'staff', avFor(u.id), initialsOf(name), now(), now()]
    );
    e++;
  }
  console.log('employees added:', e);

  // 5. Attendance sessions (slug based) -> lh_attendance
  let a = 0;
  if (await tableExists('attendance_sessions')) {
    const sessions = await db.all(`
      SELECT id, user_slug, to_char(day, 'YYYY-MM-DD') AS day,
             to_char(in_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS in_t,
             to_char(out_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS out_t,
             mode, note, created_at::text AS created_at
      FROM attendance_sessions ORDER BY id`);
    for (const s of sessions) {
      const emp = slugToId[s.user_slug];
      if (!emp) { console.log('  skip session for unknown slug', s.user_slug); continue; }
      const exists = await db.get('SELECT id FROM lh_attendance WHERE emp = ? AND date = ?', [emp, s.day]);
      if (exists) continue;
      await db.run(
        'INSERT INTO lh_attendance (id, emp, date, clock_in, clock_out, mode, status, ot_hours, fine_hours, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)',
        ['a_mig' + s.id, emp, s.day, s.in_t || '', s.out_t || '', (s.mode === 'wfh' || s.mode === 'office') ? s.mode : 'office', 'present', s.note || '', s.created_at || now(), now()]
      );
      a++;
    }
  }
  console.log('attendance rows added:', a);

  // 6. Leave requests -> lh_leaves
  let l = 0;
  if (await tableExists('leave_requests')) {
    const leaves = await db.all("SELECT id, user_slug, type, to_char(from_date,'YYYY-MM-DD') AS from_date, to_char(to_date,'YYYY-MM-DD') AS to_date, reason, status, created_at::text AS created_at FROM leave_requests ORDER BY id");
    for (const r of leaves) {
      const emp = slugToId[r.user_slug];
      if (!emp) continue;
      const id = 'l_mig' + r.id;
      if (await db.get('SELECT id FROM lh_leaves WHERE id = ?', [id])) continue;
      await db.run('INSERT INTO lh_leaves (id, emp, from_date, to_date, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, emp, r.from_date, r.to_date, [r.type, r.reason].filter(Boolean).join(': '), r.status === 'approved' ? 'approved' : (r.status || 'pending'), r.created_at || now(), now()]);
      l++;
    }
  }
  console.log('leaves added:', l);

  const counts = await db.get('SELECT (SELECT COUNT(*) FROM lh_employees) AS employees, (SELECT COUNT(*) FROM lh_attendance) AS attendance, (SELECT COUNT(*) FROM lh_leaves) AS leaves, (SELECT COUNT(*) FROM lh_departments) AS departments');
  console.log('totals:', counts);
}

main().then(() => process.exit(0)).catch(err => { console.error('MIGRATION FAILED:', err); process.exit(1); });
