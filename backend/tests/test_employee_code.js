'use strict';

const assert = require('assert');
const { nextEmpCode } = require('../../src/lib/format');
const employeeModel = require('../models/employee.model');
const db = require('../config/db');

async function runTests() {
  console.log('\n======================================================');
  console.log('>>> TESTING EMPLOYEE CODE AUTO-GENERATION FEATURE <<<');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function check(desc, fn) {
    try {
      fn();
      console.log(`  [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${desc}: ${err.message}`);
      failed++;
    }
  }

  async function checkAsync(desc, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${desc}: ${err.message}`);
      failed++;
    }
  }

  // --- SECTION 1: FRONTEND nextEmpCode HELPER TESTS ---
  console.log('1. Frontend nextEmpCode unit tests:');

  check('User scenario: Last employee code LH0050 -> Next is LH0051', () => {
    const list = [{ name: 'User 1', emp_id: 'LH0050' }];
    assert.strictEqual(nextEmpCode(list), 'LH0051');
  });

  check('Empty list returns LH0001', () => {
    assert.strictEqual(nextEmpCode([]), 'LH0001');
    assert.strictEqual(nextEmpCode(null), 'LH0001');
    assert.strictEqual(nextEmpCode(undefined), 'LH0001');
  });

  check('Handles lowercase lh0050 and mixed case Lh0050', () => {
    assert.strictEqual(nextEmpCode([{ emp_id: 'lh0050' }]), 'LH0051');
    assert.strictEqual(nextEmpCode([{ emp_id: 'Lh0050' }]), 'LH0051');
  });

  check('Finds true maximum among unordered list with gaps', () => {
    const list = [
      { emp_id: 'LH0001' },
      { emp_id: 'LH0047' },
      { emp_id: 'LH0050' },
      { emp_id: 'LH0019' },
      { emp_id: 'LH0031' }
    ];
    assert.strictEqual(nextEmpCode(list), 'LH0051');
  });

  check('Supports empId property (camelCase fallback)', () => {
    const list = [{ empId: 'LH0050' }];
    assert.strictEqual(nextEmpCode(list), 'LH0051');
  });

  check('Rollover and padding boundary cases', () => {
    assert.strictEqual(nextEmpCode([{ emp_id: 'LH0009' }]), 'LH0010');
    assert.strictEqual(nextEmpCode([{ emp_id: 'LH0099' }]), 'LH0100');
    assert.strictEqual(nextEmpCode([{ emp_id: 'LH0999' }]), 'LH1000');
    assert.strictEqual(nextEmpCode([{ emp_id: 'LH9999' }]), 'LH10000');
  });

  check('Safely skips non-LH codes, nulls, undefined, and empty objects', () => {
    const list = [
      { emp_id: 'EMP100' },
      { emp_id: 'CONTRACTOR_1' },
      { emp_id: '' },
      { emp_id: null },
      { name: 'No ID' },
      { emp_id: 'LH0025' }
    ];
    assert.strictEqual(nextEmpCode(list), 'LH0026');
  });

  // --- SECTION 2: BACKEND DATABASE & MODEL TESTS ---
  console.log('\n2. Backend employeeModel nextEmpId tests:');

  await checkAsync('DB nextEmpId executes and returns valid LH formatted string', async () => {
    const nextId = await employeeModel.nextEmpId();
    assert.ok(/^LH\d{4,}$/.test(nextId), `Expected LH followed by 4+ digits, got ${nextId}`);
  });

  await checkAsync('DB nextEmpId increments correctly after inserting test employee', async () => {
    const currentNext = await employeeModel.nextEmpId();
    const currentNum = parseInt(currentNext.slice(2), 10);

    // Insert a test employee with a high code, e.g., LH9000
    const testId = 'test_emp_code_' + Date.now();
    await db.run(
      "INSERT INTO lh_employees (id, name, email, emp_id, active) VALUES (?, ?, ?, ?, 1)",
      [testId, 'Test Code User', `test_code_${Date.now()}@example.com`, 'LH9000']
    );

    try {
      const nextAfterInsert = await employeeModel.nextEmpId();
      assert.strictEqual(nextAfterInsert, 'LH9001', 'Should increment from LH9000 to LH9001');
    } finally {
      // Clean up test employee
      await db.run("DELETE FROM lh_employees WHERE id = ?", [testId]);
    }

    // Verify nextEmpId returned to previous
    const restoredNext = await employeeModel.nextEmpId();
    assert.strictEqual(restoredNext, currentNext, 'Should restore to original next code after cleanup');
  });

  // --- SECTION 3: EDIT VS ADD MODAL LOGIC SIMULATION ---
  console.log('\n3. Modal logic simulation (useModals):');

  check('Add Staff mode sets value to autoEmpId', () => {
    const employees = [{ emp_id: 'LH0050' }];
    const e = null; // Adding new staff
    const autoEmpId = nextEmpCode(employees);
    const fieldValue = e ? (e.emp_id || '') : autoEmpId;
    assert.strictEqual(fieldValue, 'LH0051');
  });

  check('Edit Staff mode preserves existing employee emp_id', () => {
    const employees = [{ emp_id: 'LH0050' }];
    const e = { id: 'e1', emp_id: 'LH0020' }; // Editing existing staff
    const autoEmpId = nextEmpCode(employees);
    const fieldValue = e ? (e.emp_id || '') : autoEmpId;
    assert.strictEqual(fieldValue, 'LH0020');
  });

  check('Submit logic uses user custom code if modified', () => {
    const autoEmpId = 'LH0051';
    const d = { emp_id: 'LH0099' };
    const empIdToSave = (d.emp_id && String(d.emp_id).trim()) ? String(d.emp_id).trim() : autoEmpId;
    assert.strictEqual(empIdToSave, 'LH0099');
  });

  check('Submit logic safely falls back to autoEmpId if cleared or empty string', () => {
    const autoEmpId = 'LH0051';
    const d = { emp_id: '   ' };
    const empIdToSave = (d.emp_id && String(d.emp_id).trim()) ? String(d.emp_id).trim() : autoEmpId;
    assert.strictEqual(empIdToSave, 'LH0051');
  });

  console.log('\n======================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
