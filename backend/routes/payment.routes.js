'use strict';

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createPaymentSchema } = require('../validators/payment.validator');

router.get('/', paymentController.getAllPayments);
router.post('/', protect, restrictTo('admin', 'manager'), validate(createPaymentSchema), paymentController.createPayment);
router.put('/:id', protect, restrictTo('admin'), paymentController.updatePayment);
router.delete('/:id', protect, restrictTo('admin'), paymentController.deletePayment);

module.exports = router;
