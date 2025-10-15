const express = require('express');
const authRoutes = require('./auth');
const apiKeyRoutes = require('./apiKeys');
const { successResponse } = require('../utils/response');
const zaloRouter = require('./zalo');
const authRouter = require('./auth');
const userRouter = require('./userRouter');
const groupRouter = require('./groups');
const channelRouter = require('./channels');

const router = express.Router();
// API routes
router.use('/auth', authRouter);
router.use('/channels', channelRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/zalo', zaloRouter);
router.use('/users', userRouter);
router.use('/groups', groupRouter);

module.exports = router;