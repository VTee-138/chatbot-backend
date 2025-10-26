const express = require('express');
const router = express.Router();
const ConversationController = require('../controllers/conversationController');
const { authenticate } = require('../../../middleware/auth');

// GET /api/v1/conversations?provider=zalo&page=1&limit=20&isRead=false
router.get('/', ConversationController.getConversations);

module.exports = router;
