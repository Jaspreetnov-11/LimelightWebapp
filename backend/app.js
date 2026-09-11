'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const AppError = require('./utils/appError');
const env = require('./config/env');
const { initDatabase } = require('./database/init');

// Initialize database schema (async). Requests wait for it; a failed attempt is retried on
// the next request instead of poisoning the whole process (cold starts can hit a transient
// network error on the way to Supabase).
const db = require('./config/db');
let dbReadyPromise = null;
function ensureDb() {
  if (!dbReadyPromise) {
    dbReadyPromise = initDatabase()
      .then(async mode => { db.initError = null; console.log('[DB] ready:', mode); await require('./services/settings.service').load(); return true; })
      .catch(err => {
        db.initError = String(err && err.message || err).replace(/:[^:@\/]+@/, ':***@');
        console.error('[DB-INIT-ERROR]', db.initError);
        dbReadyPromise = null;
        return false;
      });
  }
  return dbReadyPromise;
}
ensureDb();

const { securityHeaders, sanitizeInput } = require('./middleware/security.middleware');

const app = express();

// Hold requests until the schema check has run (no-op after the first request per process)
app.use(async (req, res, next) => {
  const ok = await ensureDb();
  if (!ok && req.path.startsWith('/api') && !req.path.endsWith('/health')) {
    return res.status(503).json({ success: false, error: { message: 'Database is not available right now (' + (db.initError || 'connection failed') + '). Please try again in a moment.', statusCode: 503 } });
  }
  next();
});

// Apply security headers and input sanitization
app.use(securityHeaders);
app.use(sanitizeInput);

// Block direct access to database files, source code, and environment configurations
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (
    p.startsWith('/backend') ||
    p.startsWith('/node_modules') ||
    p.endsWith('.db') ||
    p.endsWith('.sqlite') ||
    p.endsWith('.sql') ||
    p.endsWith('.env') ||
    p.includes('.env.') ||
    p.endsWith('package.json') ||
    p.endsWith('package-lock.json')
  ) {
    return res.status(403).json({
      status: 'fail',
      message: 'Access forbidden: Protected system resource'
    });
  }
  next();
});

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Secure static uploads route (prevent stored XSS by enforcing nosniff and restrictive CSP)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(env.UPLOAD_DIR));

// Mount main API
app.use('/api', routes);

// Handle unhandled /api routes with 404
app.all('/api/*', (req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404));
});

// Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
