const express = require('express');
const {
  createFirstGroup,
  createGroup,
  getUserGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
  switchActiveGroup,
  getActiveGroup,
} = require('../controllers/groupController');
const { authenticate, requireGroupMember } = require('../middleware/auth');

const groupRouter = express.Router();

// Create first group (onboarding)
groupRouter.post('/onboarding', authenticate, createFirstGroup);

// Create additional group
groupRouter.post('/', authenticate, createGroup);

// Get user's groups
groupRouter.get('/', authenticate, getUserGroups);

// Get active group
groupRouter.get('/active', authenticate, getActiveGroup);

// Switch active group
groupRouter.post('/:groupId/switch', authenticate, switchActiveGroup);

// Get group by id
groupRouter.get(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']),
  getGroupById
);

// Get group members
groupRouter.get(
  '/:grId/members',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  getGroupMembers
);

// Invite member
groupRouter.post(
  '/:grId/members',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  inviteMember
);

// Update member role
groupRouter.put(
  '/:grId/members/:memberId',
  authenticate,
  requireGroupMember(['OWNER']),
  updateMemberRole
);

// Remove member
groupRouter.delete(
  '/:grId/members/:memberId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  removeMember
);

// Leave group
groupRouter.post(
  '/:grId/leave',
  authenticate,
  requireGroupMember(['ADMIN', 'MEMBER', 'VIEWER']),
  leaveGroup
);

// Update group
groupRouter.put(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  updateGroup
);

// Delete group
groupRouter.delete(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER']),
  deleteGroup
);

module.exports = groupRouter;
