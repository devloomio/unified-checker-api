const { Router } = require('express');
const cookieParser = require('cookie-parser');
const adminAuth = require('../../middleware/adminAuth');

const authRouter = require('./auth');
const apiKeysRouter = require('./apiKeys');
const sessionsRouter = require('./sessions');
const dashboardRouter = require('./dashboard');
const settingsRouter = require('./settings');

const router = Router();

// Parse cookies for JWT auth
router.use(cookieParser());

// Auth routes (login/logout are public)
router.use('/auth', authRouter);

// All routes below require admin JWT
router.use('/keys', adminAuth, apiKeysRouter);
router.use('/sessions', adminAuth, sessionsRouter);
router.use('/dashboard', adminAuth, dashboardRouter);
router.use('/settings', adminAuth, settingsRouter);

module.exports = router;
