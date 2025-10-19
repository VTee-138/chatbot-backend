const express = require('express');
const authRoutes = require('./auth');
const apiKeyRoutes = require('./apiKeys');
const { successResponse } = require('../utils/response');
const zaloRouter = require('./zalo');
const authRouter = require('./auth');
const userRouter = require('./userRouter');
const groupRouter = require('./groupsRouter');
const channelRouter = require('./channels');
const orderRouter = require('./orderRouter')
const oauthRouter = require('../modules/channel/routes/zalo/zaloOauthRouter')
const messageModuleRouter = require("../modules/message/routes")

const router = express.Router();
// API routes
router.use('/auth', authRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/users', userRouter);
router.use('/groups', groupRouter);
router.use('/orders', orderRouter);
router.use('/zalo', oauthRouter);
router.use('/messages', messageModuleRouter);

module.exports = router;