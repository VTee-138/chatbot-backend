const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { authenticate } = require('../middleware/auth');

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/v1/channels/:channelId
 * @desc    Get channel details by ID
 * @access  Private (requires group membership)
 */
router.get('/:channelId', channelController.getChannelById);

/**
 * @route   GET /api/v1/channels/:channelId/conversations
 * @desc    Get all conversations for a channel
 * @access  Private (requires group membership)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 * @query   status - Filter by status: OPEN, CLOSED, NEEDS_HUMAN_ATTENTION, ALL (default: OPEN)
 * @query   search - Search in customer name or phone number
 */
router.get('/:channelId/conversations', channelController.getChannelConversations);

/**
 * @route   GET /api/v1/channels/:channelId/stats
 * @desc    Get channel statistics
 * @access  Private (requires group membership)
 */
router.get('/:channelId/stats', channelController.getChannelStats);

/**
 * @route   PATCH /api/v1/channels/:channelId/status
 * @desc    Update channel status
 * @access  Private (requires admin/owner role)
 * @body    status - New status: ACTIVE, INACTIVE, PENDING, ERROR
 */
router.patch('/:channelId/status', channelController.updateChannelStatus);

module.exports = router;