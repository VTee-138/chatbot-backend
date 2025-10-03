const express = require('express');
const authRoutes = require('./auth');
const apiKeyRoutes = require('./apiKeys');
const { successResponse } = require('../utils/response');
const zaloRouter = require('./zalo');
const authRouter = require('./auth');
const userRouter = require('./userRouter');
const groupRouter = require('./groups');
const channelRouter = require('./channels');
const invitationRouter = require('./invitationRoutes');
const healthRoutes = require('./health');

const router = express.Router();

// Simple health endpoint for quick checks
router.get('/ping', (req, res) => {
  return successResponse(res, {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  }, 'Service is alive');
});

// Comprehensive health check routes
router.use('/', healthRoutes);

// API routes
router.use('/auth', authRouter);
router.use('/groups', groupRouter);
router.use('/channels', channelRouter);
router.use('/invitations', invitationRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/zalo', zaloRouter);
router.use('/users', userRouter);

module.exports = router;
