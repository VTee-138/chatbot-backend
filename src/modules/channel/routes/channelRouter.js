const express = require('express');
const ChannelController = require('../controllers/channelController');
const { authenticate } = require('../../../middleware/auth');

const router = express.Router();

// GET /channels/:groupId
router.get('/:groupId', authenticate, ChannelController.getChannels);

module.exports = router;
