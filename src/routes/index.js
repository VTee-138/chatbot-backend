const express = require('express');
const apiKeyRoutes = require('./apiKeys');
const authRouter = require('./auth');
const userRouter = require('./userRouter');
const groupRouter = require('./groupsRouter');
const orderRouter = require('./orderRouter')
const oauthRouter = require('../modules/channel/routes/zalo/zaloOauthRouter')
const messageModuleRouter = require("../modules/message/routes")
const customersRouter = require('./customersRouter');
const router = express.Router();
// API routes
router.use('/auth', authRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/users', userRouter);
router.use('/groups', groupRouter);
router.use('/orders', orderRouter);
//doi lai thanh oauth
router.use('/zalo-oauth', oauthRouter);
//doi lai thanh message
router.use('/zalo', messageModuleRouter);

router.use('/customers', customersRouter);
module.exports = router;