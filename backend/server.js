'use strict';

const path = require('path');
const express = require('express');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');


// Serve static frontend files (index.html, logo.png, etc.) from project root
const rootDir = path.resolve(__dirname, '..');
app.use(express.static(rootDir));

// SPA fallback: any non-api route serves index.html
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Start local server
const PORT = env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Limelight Workspace server running at http://localhost:${PORT}`);
  logger.info(`API Base URL: http://localhost:${PORT}/api`);
  logger.info(`Database Mode: ${env.DATABASE_TYPE}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server.');
  server.close(() => {
    logger.info('HTTP server closed.');
  });
});
