'use strict';

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/', fileController.getAllFiles);
router.post('/upload', protect, upload.single('file'), fileController.uploadFile);
router.get('/:id/download', fileController.downloadFile);
router.delete('/:id', protect, fileController.deleteFile);

module.exports = router;
