const express = require('express');
const conversationRouter = require('./conversationRouter');
const zaloMessageRouter = require('./messageRouter');
const { authenticate } = require('../../../middleware/auth');
const router = express.Router();

router.use(authenticate)
// API routes
router.use('/conversations', conversationRouter);
router.use('/', zaloMessageRouter);

module.exports = router;