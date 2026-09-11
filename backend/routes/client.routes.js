'use strict';

const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

router.get('/', protect, restrictTo('admin', 'manager'), clientController.getAllClients);
router.get('/:id', protect, restrictTo('admin'), clientController.getClientById);
router.post('/', protect, restrictTo('admin'), clientController.createClient);
router.put('/:id', protect, restrictTo('admin'), clientController.updateClient);
router.delete('/:id', protect, restrictTo('admin'), clientController.deleteClient);

module.exports = router;
