'use strict';

const fs = require('fs');
const path = require('path');
const fileModel = require('../models/file.model');
const apiResponse = require('../utils/apiResponse');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const env = require('../config/env');
const { todayISO } = require('../utils/calculations');

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getAllFiles = catchAsync(async (req, res) => {
  const files = fileModel.listWithDetails();
  return apiResponse.success(res, files);
});

const uploadFile = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { project = '' } = req.body;
  const assignedBy = req.user ? (req.user.employeeId || req.user.id) : '';
  const id = 'f_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  const fileRecord = fileModel.create({
    id,
    name: req.file.originalname,
    project,
    assigned_by: assignedBy,
    size: formatBytes(req.file.size),
    date: todayISO(),
    url: `/uploads/${req.file.filename}`,
    mime_type: req.file.mimetype
  });

  return apiResponse.created(res, fileRecord, 'File uploaded successfully');
});

const downloadFile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = fileModel.findById(id);
  if (!file) {
    throw new AppError('File not found', 404);
  }

  const filename = path.basename(file.url);
  const filePath = path.join(env.UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new AppError('File content not found on server', 404);
  }

  return res.download(filePath, file.name);
});

const deleteFile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const file = fileModel.findById(id);
  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (file.url) {
    const filename = path.basename(file.url);
    const filePath = path.join(env.UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore file removal errors
      }
    }
  }

  fileModel.delete(id);
  return apiResponse.success(res, null, 'File removed successfully');
});

module.exports = {
  getAllFiles,
  uploadFile,
  downloadFile,
  deleteFile
};
