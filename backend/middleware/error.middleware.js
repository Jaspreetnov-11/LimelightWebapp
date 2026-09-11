'use strict';

const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Global Express Error Handling Middleware
 * Centralizes all error reporting and maps database/validation exceptions to HTTP status codes.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle SQLite Unique Constraint Error
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    const field = err.message.split(': ').pop() || 'resource';
    err = new AppError(`A record with this ${field} already exists.`, 409);
  }

  // Handle SQLite Foreign Key Constraint Error
  if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
    err = new AppError('Referenced resource does not exist.', 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err = new AppError('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    err = new AppError('Your token has expired. Please log in again.', 401);
  }

  // Handle Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    err = new AppError('File size is too large. Maximum allowed size is 50MB.', 400);
  }

  if (process.env.NODE_ENV === 'development') {
    logger.error(`${req.method} ${req.originalUrl} - ${err.statusCode} - ${err.message}`);
    if (err.stack && err.statusCode === 500) {
      console.error(err.stack);
    }
  }

  return res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      statusCode: err.statusCode,
      details: err.details || null
    }
  });
};

module.exports = errorHandler;
