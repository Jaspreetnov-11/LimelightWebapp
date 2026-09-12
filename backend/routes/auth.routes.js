'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { rateLimiter } = require('../middleware/security.middleware');
const { loginSchema, registerSchema } = require('../validators/auth.validator');

const authLimiter = rateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many login attempts. Please wait a minute.' });

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.get('/me', protect, authController.getMe);
router.post('/change-password', protect, authController.changePassword);

module.exports = router;
