'use strict';

// Runs the Express backend (Model + Controller, Node.js) and the Next.js frontend (View) together.
// Usage: npm run dev   (API on :5000, web on :3000; override with API_PORT / PORT)
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apiPort = process.env.API_PORT || '5000';
const webPort = process.env.PORT || '3000';
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

function run(name, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  child.on('exit', code => { console.log(`[${name}] exited with code ${code}`); process.exit(code || 0); });
  return child;
}

const api = run('api', ['--watch', 'backend/server.js'], { PORT: apiPort });
const web = run('web', [nextBin, 'dev', '-p', webPort], { API_PROXY_TARGET: 'http://localhost:' + apiPort, PORT: webPort });

process.on('SIGINT', () => { api.kill(); web.kill(); process.exit(0); });
