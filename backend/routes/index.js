'use strict';

const env = require('../config/env');

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const employeeRoutes = require('./employee.routes');
const departmentRoutes = require('./department.routes');
const projectRoutes = require('./project.routes');
const taskRoutes = require('./task.routes');
const attendanceRoutes = require('./attendance.routes');
const leaveRoutes = require('./leave.routes');
const paymentRoutes = require('./payment.routes');
const payrollRoutes = require('./payroll.routes');
const holidayRoutes = require('./holiday.routes');
const todoRoutes = require('./todo.routes');
const fileRoutes = require('./file.routes');
const activityRoutes = require('./activity.routes');
const reportRoutes = require('./report.routes');
const clientRoutes = require('./client.routes');
const settingsRoutes = require('./settings.routes');
const pushRoutes = require('./push.routes');
const performanceRoutes = require('./performance.routes');

// Healthcheck
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Limelight Workspace API',
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    commit: env.GIT_COMMIT || null,
    db: env.DATABASE_TYPE === 'postgres' ? 'postgres (supabase)' : 'sqlite: ' + env.DATABASE_PATH,
    auth: 'supabase',
    adminApi: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    dbError: require('../config/db').initError || null
  });
});

// Mount section routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payments', paymentRoutes);
router.use('/payroll', payrollRoutes);
router.use('/holidays', holidayRoutes);
router.use('/todos', todoRoutes);
router.use('/files', fileRoutes);
router.use('/activity', activityRoutes);
router.use('/reports', reportRoutes);
router.use('/clients', clientRoutes);
router.use('/settings', settingsRoutes);
router.use('/push', pushRoutes);
router.use('/performance', performanceRoutes);

module.exports = router;
