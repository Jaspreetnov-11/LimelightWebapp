'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

/**
 * Protect routes: verifies Bearer JWT token from Authorization header or cookie
 */
const protect = catchAsync(async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to gain access.', 401));
  }

  // Verify JWT
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid authentication token.', 401));
  }

  // Find user and join employee record
  const user = db.get(
    `SELECT u.id, u.email, u.role, u.employee_id, e.name, e.dept, e.access, e.emp_id
     FROM lh_users u
     LEFT JOIN lh_employees e ON u.employee_id = e.id
     WHERE u.id = ?`,
    [decoded.id]
  );

  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // Attach user to request
  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employee_id,
    name: user.name || user.email.split('@')[0],
    dept: user.dept || '',
    access: user.access || user.role,
    empId: user.emp_id || ''
  };

  next();
});

/**
 * Role-Based Access Control (RBAC) middleware
 */
const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('User context not found. Please log in.', 401));
    }

    const userRole = (req.user.role || req.user.access || 'staff').toLowerCase();
    const isAllowed = allowedRoles.map(r => r.toLowerCase()).includes(userRole);

    if (!isAllowed && userRole !== 'admin') {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }

    next();
  };
};

/**
 * Optional Auth middleware: attaches user if token exists, but doesn't block if absent
 */
const optionalAuth = (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = db.get('SELECT id, email, role, employee_id FROM lh_users WHERE id = ?', [decoded.id]);
    if (user) {
      // Same shape as `protect` so controllers can rely on req.user.employeeId
      req.user = { id: user.id, email: user.email, role: user.role, employeeId: user.employee_id, access: user.role };
    }
  } catch (err) {
    // Ignore invalid optional tokens
  }
  next();
};

module.exports = {
  protect,
  restrictTo,
  optionalAuth
};
