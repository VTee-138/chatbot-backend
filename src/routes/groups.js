const express = require('express');
const {
  createOrganization,
  getUserOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  leaveOrganization,
} = require('../controllers/organizationController');
const { authenticate, requireOrganizationMember } = require('../middleware/auth');

const groupRouter = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateOrganizationRequest:
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
 *     OrganizationResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/Organization'
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
 * /organizations:
 *   post:
 *     summary: Create new organization
 *     description: Create a new organization with the authenticated user as owner
 *     tags: [Organizations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrganizationRequest'
 *     responses:
 *       201:
 *         description: Organization created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/OrganizationResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
groupRouter.post('/', authenticate, createOrganization);

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: Get user's organizations
 *     description: Retrieve all organizations the authenticated user is a member of
 *     tags: [Organizations]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
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
 *                           - $ref: '#/components/schemas/OrganizationResponse'
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
groupRouter.get('/', authenticate, getUserOrganizations);

/**
 * @swagger
 * /organizations/{organizationId}:
 *   get:
 *     summary: Get organization by ID
 *     description: Retrieve detailed information about a specific organization
 *     tags: [Organizations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/OrganizationResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Not a member of this organization
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Organization not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
groupRouter.get(
  '/:grId',
  authenticate,
  requireOrganizationMember(['OWNER', 'ADMIN', 'MEMBER']),
  getOrganizationById
);

/**
 * @route   PUT /api/v1/organizations/:organizationId
 * @desc    Update organization
 * @access  Private (Organization Admin/Owner)
 */
groupRouter.put(
  '/:grId',
  authenticate,
  requireOrganizationMember(['OWNER', 'ADMIN']),
  updateOrganization
);

/**
 * @route   DELETE /api/v1/organizations/:organizationId
 * @desc    Delete organization
 * @access  Private (Organization Owner)
 */
groupRouter.delete(
  '/:grId',
  authenticate,
  requireOrganizationMember(['OWNER']),
  deleteOrganization
);

/**
 * @route   GET /api/v1/organizations/:organizationId/members
 * @desc    Get organization members
 * @access  Private (Organization Member)
 */
groupRouter.get(
  '/:grId/members',
  authenticate,
  requireOrganizationMember(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  getOrganizationMembers
);

/**
 * @route   POST /api/v1/organizations/:organizationId/members
 * @desc    Invite member to organization
 * @access  Private (Organization Admin/Owner)
 */
groupRouter.post(
  '/:organizationId/members',
  authenticate,
  requireOrganizationMember(['OWNER', 'ADMIN']),
  inviteMember
);

/**
 * @route   PUT /api/v1/organizations/:organizationId/members/:userId
 * @desc    Update member role
 * @access  Private (Organization Owner)
 */
groupRouter.put(
  '/:organizationId/members/:userId',
  authenticate,
  requireOrganizationMember(['OWNER']),
  updateMemberRole
);

/**
 * @route   DELETE /api/v1/organizations/:organizationId/members/:userId
 * @desc    Remove member from organization
 * @access  Private (Organization Admin/Owner)
 */
groupRouter.delete(
  '/:organizationId/members/:userId',
  authenticate,
  requireOrganizationMember(['OWNER', 'ADMIN']),
  removeMember
);

/**
 * @route   POST /api/v1/organizations/:organizationId/leave
 * @desc    Leave organization
 * @access  Private (Organization Member)
 */
groupRouter.post(
  '/:organizationId/leave',
  authenticate,
  requireOrganizationMember(['ADMIN', 'MEMBER', 'VIEWER']),
  leaveOrganization
);

module.exports = groupRouter;
