'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');

// Ensure upload directory exists
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, env.UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});

// File filter (allow documents, images, audio, video, spreadsheets, archives)
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max limit
  },
  fileFilter
});

module.exports = upload;
