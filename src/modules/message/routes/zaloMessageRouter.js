const express = require('express');
const router = express.Router();
const ZaloMessageController = require('../controllers/zaloMessageController');

/**
 * @route   POST /api/v1/zalo/oa/send-image
 * @desc    Send an image to a user via Zalo OA
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 * @body    imageUrl - Image URL (required) - publicly accessible URL
 * @body    text - Optional message text to send with image
 */
router.post('/oa/send-image', ZaloMessageController.sendZaloImage);

/**
 * @route   POST /api/v1/zalo/oa/send-file
 * @desc    Send a file to a user via Zalo OA
 * @access  Private
 * @body    channelId - Channel ID (required)
 * @body    user_id - Zalo user ID (required)
 * @body    fileUrl - File URL (required) - publicly accessible URL
 * @body    text - Optional message text to send with file
 */
router.post('/oa/send-file', ZaloMessageController.sendZaloFile);

/**
 * @route   POST /api/v1/zalo/webhook
 * @desc    Handle Zalo webhook events
 * @access  Public (Zalo will POST to this endpoint)
 */
router.post('/webhook', ZaloMessageController.handleZaloWebhook);

// /**
//  * @route   POST /api/v1/zalo/send-message (legacy endpoint for compatibility)
//  * @desc    Send a message via Zalo OA (uses channelId and userId)
//  * @access  Private
//  * @body    channelId - Channel ID (required)
//  * @body    userId - Zalo user ID (required)
//  * @body    message - Message text (required)
//  */
// router.post('/send-message', ZaloMessageController.sendZaloMessage);
router.get('/get-messages', ZaloMessageController.getMessages);
module.exports = router;