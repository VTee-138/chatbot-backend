const express = require('express');
const router = express.Router();
const zaloController = require('../controllers/zaloController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/zalo/connect
 * @desc    Initiate Zalo OA OAuth flow (returns auth URL)
 * @access  Private (requires admin/owner role)
 * @query   groupId - The group ID to add the channel to
 */
router.get('/connect', authenticate, zaloController.initiateZaloOAuth);

/**
 * @route   GET /api/v1/zalo/callback
 * @desc    Handle Zalo OAuth callback
 * @access  Public (no auth required for OAuth callback)
 * @query   code - Authorization code from Zalo
 * @query   state - State parameter for CSRF protection
 * @query   oa_id - Zalo Official Account ID
 */
router.get('/callback', authenticate, zaloController.handleZaloCallback);

/**
 * @route   POST /api/v1/zalo/oa/get-users
 * @desc    Get list of users following the OA
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    offset - Pagination offset (default: 0)
 * @body    count - Number of users (default: 15, max: 50)
 * @body    last_interaction_period - Filter period (TODAY, 7_DAYS, 30_DAYS, 60_DAYS)
 * @body    is_follower - Filter followers (true/false)
 */
router.post('/oa/get-users', authenticate, zaloController.getZaloUsers);

/**
 * @route   POST /api/v1/zalo/oa/get-user-detail
 * @desc    Get detailed information about a user
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 */
router.post('/oa/get-user-detail', authenticate, zaloController.getUserDetail);

/**
 * @route   POST /api/v1/zalo/oa/get-conversations
 * @desc    Get conversation history with a user (paginated)
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 * @body    offset - Pagination offset (default: 0)
 * @body    count - Number of messages (default: 5, max: 10)
 */
router.post('/oa/get-conversations', authenticate, zaloController.getConversations);

/**
 * @route   POST /api/v1/zalo/oa/get-all-conversations
 * @desc    Get ALL conversation history with a user (auto-pagination)
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 * @body    forceRefresh - Force refresh cache (optional, default: false)
 * 
 * Use this endpoint when user first clicks on a conversation to load complete history.
 * The API automatically fetches all messages by paginating through Zalo API.
 */
router.post('/oa/get-all-conversations', authenticate, zaloController.getAllConversations);

/**
 * @route   POST /api/v1/zalo/oa/list-recent-chat
 * @desc    Get list of recent conversations
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    offset - Pagination offset (default: 0)
 * @body    count - Number of conversations (default: 5)
 */
router.post('/oa/list-recent-chat', authenticate, zaloController.listRecentChat);

/**
 * @route   POST /api/v1/zalo/oa/send-message
 * @desc    Send a message to a user via Zalo OA
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 * @body    text - Message text (required)
 */
router.post('/oa/send-message', authenticate, zaloController.sendMessage);

/**
 * @route   POST /api/v1/zalo/webhook
 * @desc    Handle Zalo webhook events
 * @access  Public (Zalo will POST to this endpoint)
 */
router.post('/webhook', zaloController.handleZaloWebhook);

/**
 * @route   POST /api/v1/zalo/refresh-token
 * @desc    Manually refresh access token for an OA
 * @access  Private
 * @body    oa_id - Zalo OA ID (required)
 */
router.post('/refresh-token', authenticate, zaloController.refreshAccessToken);

/**
 * @route   POST /api/v1/zalo/send-message (legacy endpoint for compatibility)
 * @desc    Send a message via Zalo OA (uses channelId and userId)
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    userId - Zalo user ID (required)
 * @body    message - Message text (required)
 */
router.post('/send-message', authenticate, zaloController.sendZaloMessage);

module.exports = router;