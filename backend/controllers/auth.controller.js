'use strict';

const authService = require('../services/auth.service');
const userModel = require('../models/user.model');
const employeeModel = require('../models/employee.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const register = catchAsync(async (req, res) => {
  const { name, email, password, phone, company, role } = req.body;
  const result = await authService.register({ name, email, password, phone, company, role });
  return apiResponse.created(res, result, 'User registered successfully');
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return apiResponse.success(res, result, 'Logged in successfully');
});

const getMe = catchAsync(async (req, res) => {
  const user = userModel.findWithEmployee(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  const employee = user.employee_id ? employeeModel.findById(user.employee_id) : null;

  return apiResponse.success(res, {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id
    },
    employee: employee || user
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = userModel.findByEmail(email);
  // Always return success for security reasons so attackers cannot enumerate valid emails
  return apiResponse.success(res, null, `If an account exists for ${email}, password reset instructions have been sent.`);
});

module.exports = {
  register,
  login,
  getMe,
  forgotPassword
};
