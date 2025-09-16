const express = require('express');
const config = require('../config');

const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const apiKeyRoutes = require('./apiKeys');
const groupRouter = require('./groups');
const zaloRouter = require('./zaloRouter');
const userRouter = require('./userRouter');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: config.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});
/**
 * @swagger
 * tags:
 *   - name: Authentication
 *   - name: Groups
 *   - name: Invitations
 *   - name: Members
 */

/**
 * @swagger
 * /groups/{grId}/invitations:
 *   post:
 *     summary: Mời thành viên vào group
 *     description: Người gửi phải là ADMIN. Tạo một Invitation với status=INVITING, token hết hạn sau 3 ngày và gửi email mời.
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [MEMBER, ADMIN]
 *             required: [email, role]
 *           example:
 *             email: example@gmail.com
 *             role: MEMBER
 *     responses:
 *       201:
 *         description: Invitation created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invitation'
 *       400:
 *         description: Invalid email or role
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Sender not ADMIN
 */

/**
 * @swagger
 * /invitations/accept/{token}:
 *   post:
 *     summary: Chấp nhận lời mời
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Accepted, Declined]
 *             required: [status]
 *           example:
 *             status: Accepted
 *     responses:
 *       200:
 *         description: Invitation processed
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Email mismatch or token expired
 *       404:
 *         description: Invitation not found
 */

/**
 * @swagger
 * /invitations/decline/{token}:
 *   post:
 *     summary: Từ chối lời mời
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invitation declined
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /groups/{grId}/invitations/{invitationId}:
 *   delete:
 *     summary: Thu hồi lời mời
 *     description: Chỉ ADMIN/OWNER được phép thu hồi
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: invitationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Invitation revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Invitation not found
 */

/**
 * @swagger
 * /groups/{grId}:
 *   get:
 *     summary: Lấy thông tin Group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       403:
 *         description: User not in group
 *       404:
 *         description: Group not found
 *   put:
 *     summary: Cập nhật thông tin Group
 *     description: Chỉ ADMIN group mới được phép
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               country:
 *                 type: string
 *               emailOwner:
 *                 type: string
 *               phone:
 *                 type: string
 *               logo:
 *                 type: string
 *             required: [name]
 *           example:
 *             name: ten-gr
 *             country: VN
 *             emailOwner: owner@email.com
 *             phone: +84901234567
 *             logo: https://domain.com/logo.png
 *     responses:
 *       200:
 *         description: Group updated
 *       403:
 *         description: Forbidden (not ADMIN)
 */

/**
 * @swagger
 * /groups/{grId}/members:
 *   get:
 *     summary: Lấy danh sách thành viên của group
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GroupMember'
 */

/**
 * @swagger
 * /groups/{grId}/members/{memberId}:
 *   patch:
 *     summary: Cập nhật quyền của thành viên
 *     description: Chỉ OWNER mới được phép
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: memberId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [OWNER, ADMIN, MEMBER]
 *             required: [role]
 *           example:
 *             role: ADMIN
 *     responses:
 *       200:
 *         description: Member updated
 *       403:
 *         description: Forbidden (not OWNER)
 *   delete:
 *     summary: Xóa thành viên khỏi group
 *     description: Chỉ OWNER được phép xóa
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: grId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: memberId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Member removed
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: Lấy danh sách group mà user là thành viên
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Group'
 */

/**
 * @swagger
 * /invitations/list:
 *   get:
 *     summary: Lấy danh sách lời mời đến cho user
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of invitations
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invitation'
 */
/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Tạo một tổ chức mới
 *     description: |
 *       - Tạo mới một group (tổ chức).
 *       - Các giá trị mặc định: autoAssignEnabled = false, receptionMode = MANUAL, creditBalance = 0, creatorId = user_id.
 *       - Sau khi tạo group thì insert thêm vào table group_members với user = creatorId, role = OWNER.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               country:
 *                 type: string
 *               emailOwner:
 *                 type: string
 *               phone:
 *                 type: string
 *               logo:
 *                 type: string
 *             required: [name, country, emailOwner, phone]
 *           example:
 *             name: ten-gr
 *             country: VN
 *             emailOwner: owner@email.com
 *             phone: +84901234567
 *             logo: https://domain.com/logo.png
 *     responses:
 *       201:
 *         description: Group created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
// API routes
router.use('/auth', authRoutes);

router.use('/groups', groupRouter);
router.use('/api-keys', apiKeyRoutes);
router.use('/zalo', zaloRouter) 
router.use('/me', userRouter)

module.exports = router;
