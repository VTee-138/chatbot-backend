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
router.get('/callback', zaloController.handleZaloCallback);

/**
 * @route   POST /api/v1/zalo/webhook
 * @desc    Handle Zalo webhook events
 * @access  Public (Zalo will POST to this endpoint)
 */
router.post('/webhook', zaloController.handleZaloWebhook);

/**
 * @route   POST /api/v1/zalo/send-message
 * @desc    Send a message via Zalo OA
 * @access  Private
 * @body    channelId - The channel ID
 * @body    userId - Zalo user ID
 * @body    message - Message text
 */
router.post('/send-message', authenticate, zaloController.sendZaloMessage);

module.exports = router;
