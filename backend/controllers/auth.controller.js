'use strict';

const authService = require('../services/auth.service');
const employeeModel = require('../models/employee.model');
const supabase = require('../config/supabase');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const register = catchAsync(async (req, res) => {
  const { name, email, password, phone, company } = req.body;
  const result = await authService.register({ name, email, password, phone, company });
  return apiResponse.created(res, result, 'User registered successfully');
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  return apiResponse.success(res, result, 'Logged in successfully');
});

const getMe = catchAsync(async (req, res) => {
  const employee = await employeeModel.findById(req.user.id);
  if (!employee) throw new AppError('User not found', 404);
  return apiResponse.success(res, {
    user: { id: employee.id, email: employee.email, role: employee.access || 'staff', employeeId: employee.id },
    employee
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (supabase.anon && email) {
    // Supabase sends the reset mail; failures are swallowed so emails cannot be enumerated.
    try { await supabase.anon.auth.resetPasswordForEmail(String(email).trim()); } catch (e) { /* ignore */ }
  }
  return apiResponse.success(res, null, `If an account exists for ${email}, password reset instructions have been sent.`);
});

/** Anyone signed in can change their own password: the current one is verified first. */
const changePassword = catchAsync(async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '').trim();
  if (next.length < 6) throw new AppError('New password must be at least 6 characters.', 400);
  if (!current) throw new AppError('Enter your current password.', 400);
  try { await supabase.signIn(req.user.email, current); } catch (e) { throw new AppError('Current password is incorrect.', 400); }
  await supabase.updateUser(req.user.id, { password: next });
  return apiResponse.success(res, null, 'Password changed. Use the new one next time you log in.');
});

module.exports = { register, login, getMe, forgotPassword, changePassword };
