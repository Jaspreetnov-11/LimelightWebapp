'use strict';

const path = require('path');
const express = require('express');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');


// The Next.js frontend (View layer) is served separately: `npm run dev` (port 3000) or Vercel.
// Any non-API request here points people to the frontend instead of serving files from the repo root.
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/uploads')) {
    return next();
  }
  res.status(200).json({
    service: 'Limelight Workspace API',
    hint: 'This is the backend. Open the Next.js app (npm run dev → http://localhost:3000). API base: /api'
  });
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
