const express = require('express');
const conversationRouter = require('./conversationRouter');
const zaloMessageRouter = require('./zaloMessageRouter')
const router = express.Router();

// API routes
router.use('/conversations', conversationRouter);
router.use('/', zaloMessageRouter);

module.exports = router;