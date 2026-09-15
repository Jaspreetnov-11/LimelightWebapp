/**
 * Automated Verification for Soft Delete, Inactive/Active filtering and Reactivation
 */
const db = require('../config/db');
const employeeModel = require('../models/employee.model');
const taskModel = require('../models/task.model');
const assert = require('assert');

async function runTest() {
  console.log('=== STARTING SOFT DELETE & INACTIVE FILTER TEST ===\n');

  const testId = 'test-soft-del-' + Date.now();
  const testEmail = `softdel_${Date.now()}@example.com`;

  try {
    // 1. Create test employee
    console.log('1. Creating test employee...');
    await employeeModel.create({
      id: testId,
      name: 'Soft Delete Test User',
      email: testEmail,
      emp_id: 'LH9998',
      role: 'Tester',
      dept: 'QA',
      salary: 30000,
      active: 1,
      shift: 'day',
      access: 'staff'
    });

    const emp = await employeeModel.findById(testId);
    assert.strictEqual(Number(emp.active), 1, 'Employee should initially be active (1)');
    console.log('  ✓ Employee created with active = 1');

    // 2. Create and assign a task
    const taskId = 'task-soft-' + Date.now();
    await taskModel.create({
      id: taskId,
      title: 'Soft delete test task',
      assignee: testId,
      status: 'in_progress',
      dept: 'QA'
    });
    console.log('  ✓ Task created and assigned to employee');

    // 3. Simulate soft delete
    console.log('\n2. Testing soft delete logic...');
    await taskModel.unassignEverywhere(testId);
    await employeeModel.update(testId, { active: 0 });

    const softDeletedEmp = await employeeModel.findById(testId);
    assert.ok(softDeletedEmp, 'Employee must NOT be removed from database');
    assert.strictEqual(Number(softDeletedEmp.active), 0, 'Employee active field should be 0 (Inactive)');
    console.log('  ✓ Employee record is retained in database with active = 0');

    const updatedTask = await taskModel.findById(taskId);
    assert.strictEqual(Boolean(updatedTask.assignee), false, 'Task assignee should be unassigned');
    console.log('  ✓ Active tasks successfully unassigned');

    // 4. Test filtering
    console.log('\n3. Testing active/inactive search filter...');
    const activeList = await employeeModel.search({ active: '1', query: 'Soft Delete Test User' });
    assert.strictEqual(activeList.some(e => e.id === testId), false, 'Employee should NOT appear in active=1 filter');
    console.log('  ✓ Excluded from active=1 list');

    const inactiveList = await employeeModel.search({ active: '0', query: 'Soft Delete Test User' });
    assert.strictEqual(inactiveList.some(e => e.id === testId), true, 'Employee MUST appear in active=0 filter');
    console.log('  ✓ Included in active=0 list');

    const allList = await employeeModel.search({ query: 'Soft Delete Test User' });
    assert.strictEqual(allList.some(e => e.id === testId), true, 'Employee MUST appear in all filter');
    console.log('  ✓ Included in unfiltered list');

    // 5. Test reactivation
    console.log('\n4. Testing reactivation...');
    await employeeModel.update(testId, { active: 1 });
    const reactivatedEmp = await employeeModel.findById(testId);
    assert.strictEqual(Number(reactivatedEmp.active), 1, 'Employee should be restored to active = 1');
    console.log('  ✓ Employee successfully reactivated to active = 1');

    console.log('\n>>> ALL SOFT DELETE & INACTIVE FILTER CHECKS PASSED SUCCESSFULLY! <<<');
  } finally {
    console.log('\nCleaning up test records...');
    await db.run('DELETE FROM lh_employees WHERE id = ?', [testId]);
    await db.run('DELETE FROM lh_tasks WHERE id LIKE ?', ['task-soft-%']);
    console.log('Cleanup done.');
  }
}

runTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
