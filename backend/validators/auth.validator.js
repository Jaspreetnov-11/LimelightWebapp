'use strict';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginSchema = {
  email: {
    required: true,
    pattern: emailRegex,
    message: 'A valid email address is required'
  },
  password: {
    required: true,
    minLength: 6,
    message: 'Password is required and must be at least 6 characters'
  }
};

const registerSchema = {
  name: {
    required: true,
    minLength: 2,
    message: 'Full name is required (minimum 2 characters)'
  },
  email: {
    required: true,
    pattern: emailRegex,
    message: 'A valid email address is required'
  },
  password: {
    required: true,
    minLength: 6,
    message: 'Password must be at least 6 characters'
  },
  phone: {
    required: false
  },
  company: {
    required: false
  },
  role: {
    required: false
  }
};

module.exports = {
  loginSchema,
  registerSchema
};
