const express = require('express')
utes = require('./auth');
const apiKeyRoutes = require('./apiKeys');
const { successResponse } = require('../utils/response');
const zaloRouter = require('./zaloRouter');
const authRouter = require('./auth');
const userRouter = require('./userRouter');
const router = express.Router();
// Health check endpoint
router.get('/health', (req, res) => {
  return successResponse(res, {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected', // You could add actual DB health check here
  }, 'Service is healthy');
});

// API routes
router.use('/auth', authRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/zalo', zaloRouter)
router.use('/me', userRouter)
module.exports = router;
