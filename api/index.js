'use strict';

// Vercel Serverless Function Entry Point
// Routes all /api/* requests to the Limelight Express MVC Backend
const app = require('../backend/app');

module.exports = app;
