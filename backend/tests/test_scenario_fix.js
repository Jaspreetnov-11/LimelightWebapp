'use strict';

const assert = require('assert');
const path = require('path');

async function runScenarioFixTest() {
  console.log('=== TEST: ATTENDANCE SCENARIO FIX & PHOTO RESTRICTION ===');

  const { initDatabase } = require('../database/init');
  await initDatabase();

  const db = require('../config/db');
  const attendanceService = require('../services/attendance.service');
  const attendanceModel = require('../models/attendance.model');
  const employeeModel = require('../models/employee.model');
  const authService = require('../services/auth.service');
  const { todayISO, punchMinutes } = require('../utils/calculations');

  const testEmpId = 'emp_scenario_fix_' + Date.now();
  const testStaffEmail = `staff_scenario_${Date.now()}@example.com`;

  try {
    // 1. Create test employee
    console.log('1. Setting up test employee...');
    const emp = await employeeModel.create({
      id: testEmpId,
      name: 'Scenario Test User',
      email: testStaffEmail,
      role: 'Staff Engineer',
      dept: 'Operations',
      salary: 45000,
      access: 'staff',
      shift: 'day',
      emp_id: 'FIX999'
    });
    assert.ok(emp);

    const today = todayISO();
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);

    // 2. Set up the exact problem scenario:
    // Yesterday (Day 11) has an unclosed punch (forgot to clock out):
    console.log(`2. Simulating unclosed punch on yesterday (${yesterday})...`);
    await attendanceModel.create({
      id: 'a_test_yest_' + Date.now(),
      emp: testEmpId,
      date: yesterday,
      clock_in: '18:38',
      clock_out: '',
      mode: 'office',
      status: 'present',
      sessions: '[]',
      late: 1
    });

    // Today (Day 12) Session 1: completed session 00:06 - 01:04 (58 mins worked)
    console.log(`3. Simulating today's (${today}) Session 1: 00:06 - 01:04...`);
    await attendanceModel.create({
      id: 'a_test_today_' + Date.now(),
      emp: testEmpId,
      date: today,
      clock_in: '00:06',
      clock_out: '01:04',
      mode: 'office',
      status: 'present',
      sessions: '[]',
      late: 0
    });

    // 3. User taps "Re-Clock In" for Session 2 on today:
    console.log('4. Attempting Re-Clock In on today (should succeed and auto-close yesterday)...');
    const dummySelfie = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-data').toString('base64');
    const recheckPunch = await attendanceService.processClockIn(testEmpId, {
      lat: 21.25, lng: 81.63, addr: 'Gaurav Path, Raipur',
      mode: 'office',
      selfie: dummySelfie
    });

    assert.ok(recheckPunch, 'Re-clock in record should be returned');
    assert.strictEqual(recheckPunch.date, today, "Punch date must be today's date");
    assert.strictEqual(recheckPunch.clock_out, '', 'Active session clock_out must be empty');

    const sessions = typeof recheckPunch.sessions === 'string' ? JSON.parse(recheckPunch.sessions) : recheckPunch.sessions;
    assert.strictEqual(sessions.length, 1, 'Previous session (00:06-01:04) must be saved in sessions array');
    assert.strictEqual(sessions[0].clock_in, '00:06');
    assert.strictEqual(sessions[0].clock_out, '01:04');
    assert.strictEqual(sessions[0].mins, 58, 'Previous session must be 58 minutes');

    // Verify that yesterday's punch was auto-closed!
    console.log("5. Verifying yesterday's dangling punch was auto-closed...");
    const yestRecord = await attendanceModel.findByEmpAndDate(testEmpId, yesterday);
    assert.ok(yestRecord.clock_out, "Yesterday's clock_out must not be empty anymore");
    assert.ok(yestRecord.note.includes('Auto-closed at shift end'), 'Note should indicate auto-closed');
    console.log(`   ✓ Yesterday auto-closed at ${yestRecord.clock_out} with note "${yestRecord.note}"`);

    // Verify computeMonthStats reflects hours for yesterday instead of 0h
    console.log('6. Verifying monthly stats calculation...');
    const month = today.slice(0, 7);
    const monthStats = await attendanceService.getMonthStats(testEmpId, month);
    const yestStat = monthStats.days.find(x => x.date === yesterday);
    assert.ok(yestStat, 'Yesterday should exist in month days');
    assert.strictEqual(yestStat.open, false, 'Yesterday open flag should be false');
    assert.ok(yestStat.mins > 0, 'Yesterday worked minutes should be greater than 0');
    console.log(`   ✓ Yesterday stats: ${yestStat.mins} mins worked (no longer 0h/open)`);

    // 4. Test clock-out prioritization
    console.log('7. Testing Clock Out of the active session today...');
    const outPunch = await attendanceService.processClockOut(testEmpId, {
      lat: 21.25, lng: 81.63, addr: 'Gaurav Path, Raipur',
      selfie: dummySelfie
    });
    assert.ok(outPunch.clock_out, 'Active session must be clocked out');
    console.log(`   ✓ Clocked out at ${outPunch.clock_out}`);

    // If user tries to clock out again when already clocked out:
    console.log('8. Testing duplicate clock-out rejection...');
    let caughtDup = false;
    try {
      await attendanceService.processClockOut(testEmpId, { lat: 21.25, lng: 81.63 });
    } catch (e) {
      caughtDup = true;
      assert.ok(e.message.includes('Already clocked out'), 'Error should be "Already clocked out"');
    }
    assert.strictEqual(caughtDup, true, 'Duplicate clock-out must throw error');
    console.log('   ✓ Duplicate clock out correctly rejected.');

    // 5. Test Selfie Access Permissions (Admin only, staff gets 403)
    console.log('9. Testing selfie access permissions...');
    const attendanceController = require('../controllers/attendance.controller');

    // Create a dummy response mock
    const createMockRes = () => {
      const res = {
        headers: {},
        statusCode: 200,
        data: null,
        setHeader(k, v) { this.headers[k] = v; },
        status(c) { this.statusCode = c; return this; },
        send(d) { this.data = d; return this; },
        json(j) { this.data = j; return this; }
      };
      return res;
    };

    // Staff attempt -> should call next with 403 AppError
    const staffReq = {
      params: { id: recheckPunch.id, which: 'in' },
      user: { id: testEmpId, role: 'staff', access: 'staff' }
    };
    let staffForbidden = false;
    await new Promise(resolve => {
      attendanceController.getSelfie(staffReq, createMockRes(), err => {
        if (err) {
          staffForbidden = true;
          assert.strictEqual(err.statusCode, 403, 'Staff access should be 403 Forbidden');
          assert.ok(err.message.includes('Only admins can view attendance verification photos'));
        }
        resolve();
      });
    });
    assert.strictEqual(staffForbidden, true, 'Staff MUST be blocked from viewing selfies with 403');
    console.log('   ✓ Staff user correctly blocked with 403 Forbidden.');

    // Admin attempt -> should succeed
    const adminReq = {
      params: { id: recheckPunch.id, which: 'in' },
      user: { id: 'admin_id_test', role: 'admin', access: 'admin' }
    };
    const adminRes = createMockRes();
    let adminError = null;
    await new Promise((resolve, reject) => {
      attendanceController.getSelfie(adminReq, adminRes, err => {
        if (err) adminError = err;
        resolve();
      });
      setTimeout(resolve, 50);
    });
    assert.strictEqual(adminError, null, 'Admin should not receive an error');
    assert.strictEqual(adminRes.headers['Content-Type'], 'image/jpeg', 'Content-Type should be image/jpeg');
    assert.ok(adminRes.data instanceof Buffer, 'Admin should receive image Buffer');
    console.log('   ✓ Admin user successfully retrieved selfie photo.');

    console.log('\n=== ALL SCENARIO TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    // Cleanup test employee & test attendance
    console.log('Cleaning up test data...');
    await db.run('DELETE FROM lh_attendance WHERE emp = ?', [testEmpId]);
    await db.run('DELETE FROM lh_employees WHERE id = ?', [testEmpId]);
    console.log('Cleanup done.');
  }
}

runScenarioFixTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
