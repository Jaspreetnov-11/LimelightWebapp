'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const AppError = require('./utils/appError');
const env = require('./config/env');
const { initDatabase } = require('./database/init');

// Initialize database schema and seeds
try {
  initDatabase();
} catch (err) {
  console.error('[DB-INIT-ERROR]', err);
}

const { securityHeaders, sanitizeInput } = require('./middleware/security.middleware');

const app = express();

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
