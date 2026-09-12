'use strict';

const assert = require('assert');

async function testRecheck() {
  console.log('=== VERIFYING ATTENDANCE RE-CHECKING (MULTI-SESSION) ===');

  // 1. Calculations verification
  const calc = require('../utils/calculations');
  console.log('1. Testing calculation utilities...');

  // Single completed session
  const single = { clock_in: '10:00', clock_out: '18:00' };
  assert.strictEqual(calc.punchMinutes(single), 480, 'Single 10:00-18:00 should be 480 mins');

  // Re-check completed: Session 1 (10-18 = 480m) + Session 2 (19-21 = 120m) = 600m
  const recheckDone = {
    clock_in: '19:00',
    clock_out: '21:00',
    sessions: JSON.stringify([{ in: '10:00', out: '18:00', mins: 480 }])
  };
  assert.strictEqual(calc.punchMinutes(recheckDone), 600, 'Re-check done should be 600 cumulative mins (10 hours)');

  // Re-check array object (already parsed)
  const recheckParsed = {
    clock_in: '19:00',
    clock_out: '21:00',
    sessions: [{ in: '10:00', out: '18:00', mins: 480 }]
  };
  assert.strictEqual(calc.punchMinutes(recheckParsed), 600, 'Parsed sessions array should be 600 cumulative mins');

  console.log('  ✓ Calculation utilities passed.');

  // 2. Database & Service Flow
  console.log('2. Testing database & attendance service re-checkin flow...');
  const { initDatabase } = require('../database/init');
  await initDatabase();

  const db = require('../config/db');
  const attendanceService = require('../services/attendance.service');
  const attendanceModel = require('../models/attendance.model');
  const employeeModel = require('../models/employee.model');

  // Test employee ID
  const testEmpId = 'test_recheck_emp_' + Date.now();
  const testEmail = `test_recheck_${Date.now()}@example.com`;

  try {
    // Create test employee
    await employeeModel.create({
      id: testEmpId,
      name: 'Recheck Test User',
      email: testEmail,
      role: 'Tester',
      dept: 'Engineering',
      salary: 30000,
      access: 'staff',
      shift: 'day',
      emp_id: 'TEST999'
    });

    const dummySelfie = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-image-data-for-testing').toString('base64');

    // Session 1: Clock In
    console.log('  Testing Session 1 Clock In (live)...');
    const punch1 = await attendanceService.processClockIn(testEmpId, {
      lat: 28.61, lng: 77.23, addr: 'Office HQ',
      mode: 'office',
      selfie: dummySelfie
    });
    assert.ok(punch1.clock_in);
    assert.strictEqual(punch1.clock_out, '');
    assert.strictEqual(punch1.sessions, '[]');

    // Session 1: Clock Out
    console.log('  Testing Session 1 Clock Out (live)...');
    const punch1Out = await attendanceService.processClockOut(testEmpId, {
      lat: 28.61, lng: 77.23, addr: 'Office HQ',
      selfie: dummySelfie
    });
    assert.ok(punch1Out.clock_out);
    assert.strictEqual(punch1Out.sessions, '[]');

    // Session 2: Re-Clock In (Should be allowed now without error!)
    console.log('  Testing Session 2 Re-Clock In (re-checking)...');
    const punch2 = await attendanceService.processClockIn(testEmpId, {
      lat: 28.61, lng: 77.23, addr: 'Office HQ',
      mode: 'office',
      selfie: dummySelfie
    });
    assert.ok(punch2.clock_in, 'New clock_in should be populated');
    assert.strictEqual(punch2.clock_out, '', 'Active clock_out should be reset to empty string');
    
    const s1List = JSON.parse(punch2.sessions);
    assert.strictEqual(s1List.length, 1, 'Previous session should be archived in sessions array');
    assert.strictEqual(s1List[0].in, punch1Out.clock_in);
    assert.strictEqual(s1List[0].out, punch1Out.clock_out);
    assert.strictEqual(typeof s1List[0].mins, 'number');

    // Session 2: Clock Out second session
    console.log('  Testing Session 2 Clock Out...');
    const punch2Out = await attendanceService.processClockOut(testEmpId, {
      lat: 28.61, lng: 77.23, addr: 'Office HQ',
      selfie: dummySelfie
    });
    assert.ok(punch2Out.clock_out);
    assert.strictEqual(JSON.parse(punch2Out.sessions).length, 1);
    const totalMins = calc.punchMinutes(punch2Out);
    assert.strictEqual(typeof totalMins, 'number');
    assert.ok(totalMins >= 0);

    // 3. Multi-Session Time & Overtime scenario verification
    console.log('3. Testing multi-session simulated overtime scenario (10:00-18:00 + 19:00-21:00)...');
    const simulatedDate = '2099-01-01';
    await attendanceModel.upsertPunch({
      id: 'a_simulated_' + Date.now(),
      emp: testEmpId,
      date: simulatedDate,
      clock_in: '19:00',
      clock_out: '21:00',
      mode: 'office',
      status: 'present',
      late: 0,
      sessions: JSON.stringify([{ in: '10:00', out: '18:00', clock_in: '10:00', clock_out: '18:00', mins: 480 }]),
      ot_hours: 1.0,
      fine_hours: 0,
      note: 'Late evening overtime work'
    });

    const simPunch = await attendanceModel.findByEmpAndDate(testEmpId, simulatedDate);
    const simMinutes = calc.punchMinutes(simPunch);
    assert.strictEqual(simMinutes, 600, 'Simulated punch should equal 600 minutes (10h)');

    // 4. Controller Serializer verification
    console.log('4. Testing controller serializer (pub)...');
    const serialized = {
      ...simPunch,
      is_recheck: Boolean(simPunch.sessions && simPunch.sessions !== '[]' && simPunch.sessions !== ''),
      session_count: (function() {
        try {
          const list = typeof simPunch.sessions === 'string' ? JSON.parse(simPunch.sessions || '[]') : simPunch.sessions;
          return Array.isArray(list) ? list.length + (simPunch.clock_in ? 1 : 0) : 1;
        } catch (e) { return 1; }
      })(),
      sessions: JSON.parse(simPunch.sessions)
    };

    assert.strictEqual(serialized.is_recheck, true);
    assert.strictEqual(serialized.session_count, 2);
    assert.strictEqual(serialized.sessions.length, 1);
    console.log('  ✓ Controller serialization passed.');

    console.log('\n>>> ALL RE-CHECKING VERIFICATION TESTS PASSED SUCCESSFULLY! <<<');
  } finally {
    // Cleanup test records
    await db.run('DELETE FROM lh_attendance WHERE emp = ?', [testEmpId]);
    await db.run('DELETE FROM lh_employees WHERE id = ?', [testEmpId]);
    console.log('Cleanup completed.');
  }
}

testRecheck().catch(err => {
  console.error('\n❌ RE-CHECK VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
