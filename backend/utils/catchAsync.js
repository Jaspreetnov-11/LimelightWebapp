'use strict';

/**
 * Wraps async route handlers to automatically catch any thrown errors
 * and forward them to Express's global error handler.
 * DRY principle: eliminates repetitive try-catch blocks across all controllers.
 */
const catchAsync = fn => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
