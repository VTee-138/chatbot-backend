const express = require('express');
const {
    acceptInvitation,
    declineInvitation,
    revokeInvitation,
} = require('../controllers/invitationController');
const { authenticate } = require('../middleware/auth');
const { successResponse } = require('../utils/response');

const invitationRouter = express.Router();

// Accept an invitation
invitationRouter.post('/accept', acceptInvitation);

// Decline an invitation
invitationRouter.post('/decline', declineInvitation);

// Revoke a pending invitation
invitationRouter.delete('/:id', authenticate, revokeInvitation);

module.exports = invitationRouter;