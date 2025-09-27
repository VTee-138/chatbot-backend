const express = require('express');
const {
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
} = require('../controllers/groupController');
const { authenticate, requireGroupMember } = require('../middleware/auth');

const groupRouter = express.Router();

// Create group
groupRouter.post('/', authenticate, createGroup);

// Get user's groups
groupRouter.get('/', authenticate, getUserGroups);

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
