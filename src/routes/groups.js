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
const { authenticate, req, requireGroupMember } = require('../middleware/auth');

const groupRouter = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateGroupRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: My Company
 *         description:
 *           type: string
 *           nullable: true
 *           example: An awesome company description
 *         logo:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: https://example.com/logo.png
 *     GroupResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/Group'
 *         - type: object
 *           properties:
 *             creator:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 email:
 *                   type: string
 *                   format: email
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *             members:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   role:
 *                     type: string
 *                     enum: [OWNER, ADMIN, MEMBER, VIEWER]
 *                   joinedAt:
 *                     type: string
 *                     format: date-time
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *             _count:
 *               type: object
 *               properties:
 *                 members:
 *                   type: integer
 *                 apiKeys:
 *                   type: integer
 */

/**
 * @swagger
 * /Groups:
 *   post:
 *     summary: Create new Group
 *     description: Create a new Group with the authenticated user as owner
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupRequest'
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/GroupResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
groupRouter.post('/', authenticate, createGroup);

/**
 * @swagger
 * /Groups:
 *   get:
 *     summary: Get user's Groups
 *     description: Retrieve all Groups the authenticated user is a member of
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/GroupResponse'
 *                           - type: object
 *                             properties:
 *                               membershipRole:
 *                                 type: string
 *                                 enum: [OWNER, ADMIN, MEMBER, VIEWER]
 *                               joinedAt:
 *                                 type: string
 *                                 format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
groupRouter.get('/', authenticate, getUserGroups);

/**
 * @swagger
 * /Groups/{GroupId}:
 *   get:
 *     summary: Get Group by ID
 *     description: Retrieve detailed information about a specific Group
 *     tags: [Groups]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: GroupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Group ID
 *     responses:
 *       200:
 *         description: Group retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/GroupResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not a member of this Group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Group not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
groupRouter.get(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']),
  getGroupById
);
groupRouter.get('/api/v1/groups/:grId/members', authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']), getGroupMembers)
groupRouter.patch('/api/v1/groups/:grId/members/:memberId', authenticate, requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']), updateMemberRole)
groupRouter.delete('/api/v1/groups/:grId/members/:memberId', authenticate,requireGroupMember(['OWNER', 'ADMIN']), removeMember)
groupRouter.get('/api/v1/groups', authenticate, requireGroupMember(['OWNER', 'ADMIN', 'MEMBER']), getUserGroups)
/**
 * @route   PUT /api/v1/Groups/:GroupId
 * @desc    Update Group
 * @access  Private (Group Admin/Owner)
 */
groupRouter.put(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  updateGroup
);

/**
 * @route   DELETE /api/v1/Groups/:GroupId
 * @desc    Delete Group
 * @access  Private (Group Owner)
 */
groupRouter.delete(
  '/:grId',
  authenticate,
  requireGroupMember(['OWNER']),
  deleteGroup
);

/**
 * @route   GET /api/v1/Groups/:GroupId/members
 * @desc    Get Group members
 * @access  Private (Group Member)
 */
groupRouter.get(
  '/:grId/members',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  getGroupMembers
);

/**
 * @route   POST /api/v1/Groups/:GroupId/members
 * @desc    Invite member to Group
 * @access  Private (Group Admin/Owner)
 */
groupRouter.post(
  '/:GroupId/members',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  inviteMember
);

/**
 * @route   PUT /api/v1/Groups/:GroupId/members/:userId
 * @desc    Update member role
 * @access  Private (Group Owner)
 */
groupRouter.put(
  '/:GroupId/members/:userId',
  authenticate,
  requireGroupMember(['OWNER']),
  updateMemberRole
);

/**
 * @route   DELETE /api/v1/Groups/:GroupId/members/:userId
 * @desc    Remove member from Group
 * @access  Private (Group Admin/Owner)
 */
groupRouter.delete(
  '/:GroupId/members/:userId',
  authenticate,
  requireGroupMember(['OWNER', 'ADMIN']),
  removeMember
);

/**
 * @route   POST /api/v1/Groups/:GroupId/leave
 * @desc    Leave Group
 * @access  Private (Group Member)
 */
groupRouter.post(
  '/:GroupId/leave',
  authenticate,
  requireGroupMember(['ADMIN', 'MEMBER', 'VIEWER']),
  leaveGroup
);

module.exports = groupRouter;
