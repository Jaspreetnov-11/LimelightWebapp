'use strict';

const AppError = require('../utils/appError');

// In-memory rate limiting map: ip -> { count, resetAt }
const rateLimitMap = new Map();

// Periodic cleanup of expired rate limit entries every 5 minutes (unref so it doesn't block process exit)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Lightweight IP rate limiter for sensitive endpoints (e.g. login, register)
 * Zero external dependencies.
 */
function rateLimiter({ windowMs = 60 * 1000, max = 15, message = 'Too many requests, please try again later.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}:${req.path}:${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      rateLimitMap.set(key, record);
    } else {
      record.count++;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      return next(new AppError(message, 429));
    }

    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * Input sanitizer middleware to strip null bytes
 */
function sanitizeInput(req, res, next) {
  const sanitize = obj => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\0/g, '');
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };

  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);

  next();
}

module.exports = {
  rateLimiter,
  securityHeaders,
  sanitizeInput
};
