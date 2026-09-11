'use strict';

const assert = require('assert');
const app = require('../app');

// Mini HTTP test client without external dependencies
async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    // Create mock req and res
    const http = require('http');
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path,
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

async function runTests() {
  console.log('--- STARTING BACKEND API VERIFICATION SUITE ---');
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

  // 1. Healthcheck
  await test('GET /api/health returns 200 OK', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  // 2. Auth - Login
  let authToken = '';
  let employeeId = '';
  await test('POST /api/auth/login succeeds with valid credentials', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'admin@lighthouse.io',
      password: 'Lighthouse@123'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    authToken = res.body.data.token;
    employeeId = res.body.data.employee.id;
  });

  // 3. Auth - Validation error on invalid email
  await test('POST /api/auth/login fails on invalid email (400)', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'notanemail',
      password: 'short'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 4. Auth - Get Me
  await test('GET /api/auth/me returns current user profile', async () => {
    const res = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${authToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.user.email, 'admin@lighthouse.io');
  });

  // 5. Employees - List
  await test('GET /api/employees returns staff list with balances', async () => {
    const res = await request('GET', '/api/employees');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
  });

  // 6. Departments - List
  await test('GET /api/departments returns departments', async () => {
    const res = await request('GET', '/api/departments');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some(d => d.name === 'Operations'));
  });

  // 7. Projects - List
  await test('GET /api/projects returns projects with consumed minutes', async () => {
    const res = await request('GET', '/api/projects');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  // 8. Tasks - List and Status update
  let testTaskId = '';
  await test('POST /api/tasks creates a task', async () => {
    const res = await request('POST', '/api/tasks', {
      title: 'Automated test task',
      status: 'pipeline',
      mins: 30
    }, { Authorization: `Bearer ${authToken}` });
    assert.strictEqual(res.status, 201);
    testTaskId = res.body.data.id;
  });

  await test('PATCH /api/tasks/:id/status moves task on Kanban board', async () => {
    const res = await request('PATCH', `/api/tasks/${testTaskId}/status`, {
      status: 'completed'
    }, { Authorization: `Bearer ${authToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'completed');
  });

  // 9. Attendance - Today status and stats
  await test('GET /api/attendance/today returns attendance dashboard summary', async () => {
    const res = await request('GET', '/api/attendance/today', null, {
      Authorization: `Bearer ${authToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.summary);
  });

  // 10. Leaves - List
  await test('GET /api/leaves returns leaves list', async () => {
    const res = await request('GET', '/api/leaves');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  // 11. Payments & Payroll
  await test('GET /api/payroll returns calculated monthly payroll', async () => {
    const res = await request('GET', '/api/payroll');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.summary);
    assert.ok(Array.isArray(res.body.data.rows));
  });

  // 12. Todos - CRUD
  let testTodoId = '';
  await test('POST /api/todos creates a to-do', async () => {
    const res = await request('POST', '/api/todos', {
      text: 'Write automated test'
    }, { Authorization: `Bearer ${authToken}` });
    assert.strictEqual(res.status, 201);
    testTodoId = res.body.data.id;
  });

  await test('PATCH /api/todos/:id/toggle toggles done status', async () => {
    const res = await request('PATCH', `/api/todos/${testTodoId}/toggle`, {}, {
      Authorization: `Bearer ${authToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.done, 1);
  });

  // 13. Reports - CSV export
  await test('GET /api/reports/payroll-summary exports valid CSV', async () => {
    const res = await request('GET', '/api/reports/payroll-summary');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string' && res.body.includes('Staff Name'));
  });

  // 14. Activity & Alerts
  await test('GET /api/activity/alerts returns system alerts', async () => {
    const res = await request('GET', '/api/activity/alerts');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body.data.totalAlerts === 'number');
  });

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
