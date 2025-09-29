const express = require('express');
const {
  createGroup,
  getUserGroups,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveGroup,
} = require('../controllers/groupController');
const { authenticate, requireGroupMember } = require('../middleware/auth');
const { getInvitations, revokeInvitation } = require('../controllers/invitationController');

const groupRouter = express.Router();

// [ ]
groupRouter.post(
  '/', 
  authenticate, 
  createGroup);
// [x]
groupRouter.get(
  '/:id', 
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']),
  getUserGroups);

// groupRouter.get(
//   '/:id',
//   authenticate,
//   requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']),
//   getGroupById
// );

// [ x ]
groupRouter.get(
  '/:id/members',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']),
  getGroupMembers
);

// [ ]
// Update thông tin group
groupRouter.put(
  '/:id',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  updateGroup
);
// [ ] => Chưa có Route này
// groupRouter.delete(
//   '/:id',
//   authenticate,
//   requireGroupMember(['OWNER']),
//   deleteGroup
// );

// [ ]
groupRouter.post(
  '/:id/invite',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  inviteMember
);
groupRouter.get(
  '/:id/invite', 
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  getInvitations
)
groupRouter.delete(
  ':id/invite/:invitationId',
  authenticate,
  requireGroupMember(['OWNER']),
  revokeInvitation
)
// [ x ]
groupRouter.put(
  '/:id/members/:userId',
  authenticate,
  requireGroupMember(['OWNER']),
  updateMemberRole
);
// [ x ]
groupRouter.delete(
  '/:id/members/:userId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  removeMember
);

// [ ] Hasn't need
// groupRouter.post(
//   '/:id/leave',
//   authenticate,
//   requireGroupMember(['ADMIN', 'MEMBER']),
//   leaveGroup
// );

module.exports = groupRouter;
