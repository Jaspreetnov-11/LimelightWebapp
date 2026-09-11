'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const employeeModel = require('../models/employee.model');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

function readToken(req) {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

function shapeUser(emp) {
  const role = emp.access || 'staff';
  return {
    id: emp.id,
    email: emp.email,
    role,
    employeeId: emp.id,
    name: emp.name || String(emp.email || '').split('@')[0],
    dept: emp.dept || '',
    access: role,
    empId: emp.emp_id || ''
  };
}

/**
 * Protect routes: verifies the API JWT and loads the employee (id = Supabase Auth user id).
 */
const protect = catchAsync(async (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    return next(new AppError('You are not logged in. Please log in to gain access.', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid authentication token.', 401));
  }

  const emp = await employeeModel.findById(decoded.id);
  if (!emp) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }
  if (emp.active !== undefined && emp.active !== null && Number(emp.active) === 0) {
    return next(new AppError('This account is deactivated.', 403));
  }

  req.user = shapeUser(emp);
  next();
});

/**
 * Role-Based Access Control
 */
const restrictTo = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new AppError('User context not found. Please log in.', 401));
  const userRole = (req.user.role || req.user.access || 'staff').toLowerCase();
  const isAllowed = allowedRoles.map(r => r.toLowerCase()).includes(userRole);
  if (!isAllowed && userRole !== 'admin') {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

/**
 * Optional auth: attaches req.user when a valid token is present, never blocks.
 */
const optionalAuth = async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const emp = await employeeModel.findById(decoded.id);
    if (emp) req.user = shapeUser(emp);
  } catch (err) {
    // ignore invalid optional tokens
  }
  next();
};

module.exports = { protect, restrictTo, optionalAuth };
