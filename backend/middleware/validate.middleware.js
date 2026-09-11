'use strict';

const AppError = require('../utils/appError');

/**
 * Generic DRY Validation Middleware Factory
 * Supports rules for type, required, min, max, regex, enum, custom functions.
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const val = data[field];

      // Required check
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors[field] = rules.message || `${field} is required`;
        continue;
      }

      // If value is missing and not required, skip remaining checks
      if (val === undefined || val === null || val === '') {
        continue;
      }

      // Type check
      if (rules.type) {
        if (rules.type === 'number' && isNaN(Number(val))) {
          errors[field] = `${field} must be a valid number`;
          continue;
        }
        if (rules.type === 'boolean' && typeof val !== 'boolean' && val !== 'true' && val !== 'false' && val !== 0 && val !== 1) {
          errors[field] = `${field} must be a boolean`;
          continue;
        }
        if (rules.type === 'string' && typeof val !== 'string') {
          errors[field] = `${field} must be a string`;
          continue;
        }
        if (rules.type === 'array' && !Array.isArray(val)) {
          errors[field] = `${field} must be an array`;
          continue;
        }
      }

      // String min/max length
      if (typeof val === 'string') {
        if (rules.minLength && val.length < rules.minLength) {
          errors[field] = `${field} must be at least ${rules.minLength} characters`;
        }
        if (rules.maxLength && val.length > rules.maxLength) {
          errors[field] = `${field} must not exceed ${rules.maxLength} characters`;
        }
      }

      // Number min/max
      if (rules.type === 'number' || typeof val === 'number') {
        const num = Number(val);
        if (rules.min !== undefined && num < rules.min) {
          errors[field] = `${field} must be at least ${rules.min}`;
        }
        if (rules.max !== undefined && num > rules.max) {
          errors[field] = `${field} must be at most ${rules.max}`;
        }
      }

      // Pattern / Regex check
      if (rules.pattern && typeof val === 'string') {
        if (!rules.pattern.test(val)) {
          errors[field] = rules.message || `${field} is invalid`;
        }
      }

      // Enum check
      if (rules.enum && Array.isArray(rules.enum)) {
        if (!rules.enum.includes(val)) {
          errors[field] = `${field} must be one of [${rules.enum.join(', ')}]`;
        }
      }

      // Custom validation function
      if (rules.custom && typeof rules.custom === 'function') {
        const customResult = rules.custom(val, data);
        if (customResult !== true) {
          errors[field] = typeof customResult === 'string' ? customResult : `${field} failed validation`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(new AppError('Validation failed', 400, errors));
    }

    next();
  };
};

module.exports = validate;
