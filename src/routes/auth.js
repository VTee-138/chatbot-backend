const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgot,
  verifyMail,
  resendVerifyEmail,
  googleSSOLogin,
  facebookSSOLogin,
  resetPassword
} = require('../controllers/authController');
const { authenticate, isAccountForgotExists, authLimiter } = require('../middleware/auth');
const schemaValidate = require('../utils/schemaValidate');
const { ResetPasswordSchema, RegisterNewUserSchema, ResetForgotPasswordSchema, EmailSchema, LoginSchema } = require('../utils/schema');
const { redisValidate } = require('../utils/validate');
const authRouter = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: user1@example.com
 *             password: user123456
 *             confirmPassword: user123456
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/register', authLimiter, redisValidate('register'), schemaValidate(RegisterNewUserSchema, "body"), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user and return JWT tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schema /LoginRequest'
 *           examples:
 *             admin:
 *               summary: Admin account
 *               value:
 *                 email: admin@example.com
 *                 password: admin123456
 *             user1:
 *               summary: Regular user
 *               value:
 *                 email: user1@example.com
 *                 password: user123456
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/login', schemaValidate(LoginSchema, "body"), login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Get new access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate current session
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/logout', authenticate, logout);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/User'
 *                         - type: object
 *                           properties:
 *                             organizations:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   role:
 *                                     type: string
 *                                     enum: [OWNER, ADMIN, MEMBER, VIEWER]
 *                                   joinedAt:
 *                                     type: string
 *                                     format: date-time
 *                                   organization:
 *                                     type: object
 *                                     properties:
 *                                       id:
 *                                         type: string
 *                                         format: uuid
 *                                       name:
 *                                         type: string
 *                                       slug:
 *                                         type: string
 *                                       logo:
 *                                         type: string
 *                                         nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.get('/profile', authenticate, getProfile);

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: https://example.com/avatar.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.put('/profile', authenticate, updateProfile);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user's password 
 *     description: Change authenticated user's password
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *               - confirmNewPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 example: 12345678Asd
 *               newPassword:
 *                 type: string
 *                 minLength: 8  
 *                 description: 'Password phải có ít nhất 8 kí tự, gồm cả chữ và số'
 *                 example: AIPencil23
 *               confirmNewPassword:
 *                 type: string
 *                 description: Phải trung với newPassword
 *                 example: AIPencil123
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Current password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/change-password', authenticate, schemaValidate(ResetPasswordSchema, "body"), changePassword);
authRouter.post('/forgot',  schemaValidate(EmailSchema, "body"), redisValidate('forgot'), forgot)
authRouter.post('/reset-password',schemaValidate(ResetForgotPasswordSchema, 'validate'), resetPassword)
authRouter.post('/verify-email', verifyMail) // sẽ gửi jwt chứa các loại thông tin đến, tùy vào type sẽ validate thông tin của người dùng
authRouter.post('/google/checkpoint', googleSSOLogin)
authRouter.post('/facebook/checkpoint', facebookSSOLogin)
authRouter.post('/sso/:provider/callback')
authRouter.post('/me')

// router.post('/facebook/callback', )

module.exports = authRouter;
