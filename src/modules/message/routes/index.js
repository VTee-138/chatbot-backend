const express = require('express');
const conversationRouter = require('./conversationRouter');
const router = express.Router();
// API routes
router.use('/conversations', conversationRouter);


module.exports = router;