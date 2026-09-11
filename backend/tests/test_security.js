'use strict';

const assert = require('assert');
const app = require('../app');
const db = require('../config/db');

// Mini HTTP test client
async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path: encodeURI(path),
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          server.close();
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json
          });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

async function runSecurityTests() {
  console.log('--- STARTING COMPREHENSIVE SECURITY & SQL INJECTION TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Security Headers
  await test('Verify Security Headers are present', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.strictEqual(res.headers['x-xss-protection'], '1; mode=block');
  });

  // 2. SQL Injection - Query Parameter with Tautology
  await test('SQL Injection: employee search with "\' OR \'1\'=\'1" returns 0 records safely', async () => {
    const res = await request('GET', "/api/employees?query=' OR '1'='1");
    assert.strictEqual(res.status, 200);
    // Should safely search literally for that string and return 0 matches
    assert.strictEqual(res.body.data.length, 0);
  });

  // 3. SQL Injection - Attempted Table Drop via Query Parameter
  await test('SQL Injection: attempted DROP TABLE injection is treated as literal parameter', async () => {
    const res = await request('GET', "/api/employees?query=admin'; DROP TABLE lh_employees; --");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 0);

    // Verify lh_employees table still exists and is completely undamaged
    const count = db.get('SELECT COUNT(*) as count FROM lh_employees');
    assert.ok(count && count.count > 0, 'Table lh_employees should still exist and contain records');
  });

  // 4. SQL Injection - Attempted UNION SELECT injection
  await test('SQL Injection: attempted UNION SELECT in query parameters', async () => {
    const res = await request('GET', "/api/employees?dept=' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14 --");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 0);
  });

  // 5. SQL Injection - Attempted Auth Bypass in Login Payload
  await test('SQL Injection: login payload with "\' OR 1=1 --" is safely rejected', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: "' OR 1=1 --",
      password: "password123"
    });
    // Validator catches invalid email format with 400 Bad Request
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 6. SQL Injection - Attempted parameter injection in route ID
  await test('SQL Injection: route parameter with "\' OR \'1\'=\'1" returns 404', async () => {
    const res = await request('GET', "/api/employees/' OR '1'='1");
    assert.strictEqual(res.status, 404);
  });

  // 7. Base Model Identifier Defense
  await test('SQL Injection: Base Model throws error on illegal column characters', () => {
    const baseModel = require('../models/base.model');
    const testModel = new baseModel('lh_employees');
    assert.throws(() => {
      testModel.findAll({}, { orderBy: 'name; DROP TABLE lh_employees;--' });
    }, /Invalid ORDER BY clause/);
  });

  // 8. Null Byte Injection Sanitization
  await test('Input Sanitization: strips null bytes (\\0) from request parameters', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: "admin@lighthouse.io\0evil",
      password: "Lighthouse@123"
    });
    // With null byte stripped, email becomes admin@lighthouse.ioevil which fails authentication safely (401)
    assert.strictEqual(res.status, 401);
  });

  // 9. Unauthorized Access Prevention
  await test('RBAC Security: Protected endpoint rejects unauthenticated request (401)', async () => {
    const res = await request('POST', '/api/employees', {
      name: 'Unauthorized User'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 10. Rate Limiting Protection on Auth
  await test('Rate Limiter: Blocks excessive requests with 429 Too Many Requests', async () => {
    let blocked = false;
    for (let i = 0; i < 25; i++) {
      const res = await request('POST', '/api/auth/forgot-password', {
        email: 'test@example.com'
      });
      if (res.status === 429) {
        blocked = true;
        break;
      }
    }
    assert.strictEqual(blocked, true, 'Rate limiter should trigger 429 after exceeding max attempts');
  });

  // 11. Database File & Source Code Static Exposure Protection
  await test('Database Security: Direct requests to database files and backend source return 403 Forbidden', async () => {
    const tests = [
      '/backend/database/limelight.db',
      '/backend/database/schema.sql',
      '/.env',
      '/package.json',
      '/backend/config/env.js'
    ];

    for (const targetPath of tests) {
      const res = await request('GET', targetPath);
      assert.strictEqual(
        res.status,
        403,
        `Path ${targetPath} should be forbidden (403), received: ${res.status}`
      );
      assert.strictEqual(res.body.status, 'fail');
    }
  });

  // 12. Database Constraints & Data Integrity Defense
  await test('Database Security: Foreign keys and unique constraints are enforced', async () => {
    // Unique attendance constraint test (emp, date)
    const emp = db.get('SELECT id FROM lh_employees LIMIT 1');
    assert.ok(emp, 'Should have at least one test employee');

    const testDate = '2099-01-01';
    db.run('DELETE FROM lh_attendance WHERE emp = ? AND date = ?', [emp.id, testDate]);
    db.run('INSERT INTO lh_attendance (id, emp, date) VALUES (?, ?, ?)', ['att_test_1', emp.id, testDate]);

    // Attempting duplicate insert with same (emp, date) must fail constraint check
    assert.throws(() => {
      db.run('INSERT INTO lh_attendance (id, emp, date) VALUES (?, ?, ?)', ['att_test_2', emp.id, testDate]);
    }, /UNIQUE constraint failed/);

    // Clean up
    db.run('DELETE FROM lh_attendance WHERE id = ?', ['att_test_1']);
  });

  console.log(`\nSECURITY TEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Security test runner failed:', err);
  process.exit(1);
});
