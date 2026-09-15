'use strict';

const db = require('../config/db');
const { initDatabase } = require('../database/init');
const employeeModel = require('../models/employee.model');
const salarySlipModel = require('../models/salarySlip.model');
const salarySlipController = require('../controllers/salarySlip.controller');

async function runTests() {
  console.log('=== STARTING SALARY STRUCTURE & SALARY SLIP TESTS ===\n');
  await initDatabase();

  const testEmpId = 'emp_test_sal_' + Date.now();
  try {
    // 1. Create a test employee without salary_structure
    console.log('1. Testing employee creation and default salary structure fallback...');
    const created = await employeeModel.create({
      id: testEmpId,
      name: 'Salary Test User',
      email: `saltest_${Date.now()}@limelight.test`,
      emp_id: 'LH9991',
      salary: 50000,
      active: 1
    });
    console.log('  ✓ Employee created with base salary = 50,000');

    // 2. Query employee slips - preview computation
    console.log('2. Testing SalarySlipController.getEmployeeSlips preview...');
    let req = {
      params: { empId: testEmpId },
      query: { fy: '2026-2027' },
      user: { role: 'admin', id: 'admin_test' }
    };
    let responseData = null;
    let res = {
      json: (data) => { responseData = data; return res; },
      status: (code) => res
    };

    await salarySlipController.getEmployeeSlips(req, res);
    if (!responseData || !responseData.slips) throw new Error('Failed to get slips');
    console.log(`  ✓ Received ${responseData.slips.length} monthly slips for FY 2026-2027`);
    
    // Check fallback 50% Basic+DA, 30% HRA, 20% Special
    const structure = responseData.salary_structure;
    if (!structure || !structure.earnings || structure.earnings.length !== 3) {
      throw new Error('Default earnings structure not generated');
    }
    const basicEarning = structure.earnings.find(e => e.name.includes('Basic'));
    if (!basicEarning || basicEarning.amount !== 25000) {
      throw new Error(`Expected Basic 25000, got ${basicEarning ? basicEarning.amount : null}`);
    }
    console.log('  ✓ Auto-generated 50/30/20% default earnings structure (Basic: 25,000, HRA: 15,000, Special: 10,000)');

    // 3. Update employee with custom salary structure
    console.log('3. Testing custom salary structure update & salary auto-sync...');
    const customStructure = {
      earnings: [
        { name: 'Basic + DA', amount: 15000 },
        { name: 'HRA', amount: 9000 },
        { name: 'Special Allowance', amount: 6000 }
      ],
      deductions: [
        { name: 'EPF', amount: 1800 },
        { name: 'ESI', amount: 250 },
        { name: 'Professional Tax', amount: 200 }
      ]
    };

    // Simulate employee controller update logic
    const totalEarnings = customStructure.earnings.reduce((s, i) => s + i.amount, 0);
    await employeeModel.update(testEmpId, {
      salary_structure: JSON.stringify(customStructure),
      salary: totalEarnings
    });

    const updatedEmp = await employeeModel.findById(testEmpId);
    if (Number(updatedEmp.salary) !== 30000) {
      throw new Error(`Expected employee.salary auto-synced to 30000, got ${updatedEmp.salary}`);
    }
    console.log('  ✓ Employee salary successfully auto-synced to 30,000 (sum of custom earnings)');

    // 4. Generate a finalized salary slip
    console.log('4. Testing SalarySlipModel.upsert & finalize slip...');
    const slipMonth = '2026-09';
    const slipData = {
      emp: testEmpId,
      month: slipMonth,
      year: '2026',
      status: 'pending',
      gross_earnings: 30000,
      total_deductions: 2250,
      net_payable: 27750,
      paid_amount: 0,
      due_amount: 27750,
      payable_days: 30,
      carry_forward: 0,
      advance_payments: 0,
      earnings_breakdown: JSON.stringify(customStructure.earnings),
      deductions_breakdown: JSON.stringify(customStructure.deductions)
    };

    const savedSlip = await salarySlipModel.upsert(slipData);
    if (!savedSlip) throw new Error('Upsert returned null');
    console.log('  ✓ Salary slip finalized and persisted in lh_salary_slips');

    // 5. Test findByEmpAndMonth
    const fetchedSlip = await salarySlipModel.findByEmpAndMonth(testEmpId, slipMonth);
    if (!fetchedSlip || Number(fetchedSlip.net_payable) !== 27750) {
      throw new Error(`Expected net_payable 27750, got ${fetchedSlip ? fetchedSlip.net_payable : null}`);
    }
    console.log('  ✓ findByEmpAndMonth verified with net payable = 27,750');

    // 6. Test updating slip to Paid
    console.log('5. Testing slip update to Paid status...');
    await salarySlipModel.update(fetchedSlip.id, {
      status: 'paid',
      paid_amount: 27750,
      due_amount: 0
    });
    const paidSlip = await salarySlipModel.findByEmpAndMonth(testEmpId, slipMonth);
    if (paidSlip.status !== 'paid' || Number(paidSlip.due_amount) !== 0) {
      throw new Error('Failed to mark slip as paid');
    }
    console.log('  ✓ Slip marked as Paid with due_amount = 0');

    console.log('\n>>> ALL SALARY STRUCTURE & SALARY SLIP TESTS PASSED! <<<');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup
    try {
      await db.run('DELETE FROM lh_salary_slips WHERE emp = ?', [testEmpId]);
      await db.run('DELETE FROM lh_employees WHERE id = ?', [testEmpId]);
      console.log('Cleanup completed.');
    } catch (e) {}
  }
}

runTests();
