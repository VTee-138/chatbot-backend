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
  resetPassword,
  createSSO,
  loginSSO,
  checkEmailExists,
  checkSession,
  removeAllDevices,
  twoFactorVerify,
  twoFactorBackupCodeVerify,
  twoFactorBackupCodeRegenerate,
  reAuthenticate
} = require('../controllers/authController');
const { authenticate, isAccountForgotExists, authLimiter, authenticate2FA } = require('../middleware/auth');
const schemaValidate = require('../utils/schemaValidate');
const { ResetPasswordSchema, RegisterNewUserSchema, RegisterWithEmailSchema, ResetForgotPasswordSchema, EmailSchema, LoginSchema, LoginWithCaptchaSchema, twoFactorSchema, EmailWithCaptchaSchema } = require('../utils/schema');
const { redisValidate } = require('../utils/validate');
const cookieHelper = require('../utils/cookieHelper');
const authRouter = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account with email and CAPTCHA verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - userName
 *               - password
 *               - confirmPassword
 *               - captchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user1@example.com
 *               userName:
 *                 type: string
 *                 pattern: ^[A-Za-z0-9_-]{5,200}$
 *                 example: user123
 *               password:
 *                 type: string
 *                 pattern: ^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&._\s]{8,}$
 *                 example: user123456
 *               confirmPassword:
 *                 type: string
 *                 example: user123456
 *               phoneNumber:
 *                 type: string
 *                 pattern: ^\d{10}$
 *                 example: "0123456789"
 *                 description: Optional phone number (10 digits)
 *               captchaToken:
 *                 type: string
 *                 description: Turnstile CAPTCHA token from frontend
 *                 example: 0.cYjhq0HHbZDWUmNE-NfPCxGePH3cLpGtYuQNIl2eIRvX90XYa1utKPCOhS4j3AnY...
 *     responses:
 *       200:
 *         description: User registered successfully, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error or CAPTCHA verification failed
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
authRouter.post('/register', schemaValidate(RegisterWithEmailSchema, "body"), register);

/**
 * @swagger
 * /auth/register/check-email:
 *   post:
 *     summary: Check if email is available for registration
 *     description: Verify email availability and CAPTCHA token before registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - captchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               captchaToken:
 *                 type: string
 *                 description: Turnstile CAPTCHA token from frontend
 *                 example: 0.cYjhq0HHbZDWUmNE-NfPCxGePH3cLpGtYuQNIl2eIRvX90XYa1utKPCOhS4j3AnY...
 *     responses:
 *       200:
 *         description: Email is available for registration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: CAPTCHA verification failed or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/register/check-email', schemaValidate(EmailWithCaptchaSchema, "body"), checkEmailExists)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email, password and CAPTCHA verification, return JWT tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - captchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: user123456
 *               captchaToken:
 *                 type: string
 *                 description: Turnstile CAPTCHA token from frontend
 *                 example: 0.yRhOJDl0zaZdYmk21WfhB7HJjFKEEe1BMfc0bASZvd2vwCpQYHOxnmVOtP0_KUFia5gvWI4Uhzgh1qK2BVd2-Pu_yl2Up0...
 *           examples:
 *             admin:
 *               summary: Admin account
 *               value:
 *                 email: admin@example.com
 *                 password: admin123456
 *                 captchaToken: 0.turnstile-token-here...
 *             user1:
 *               summary: Regular user
 *               value:
 *                 email: user1@example.com
 *                 password: user123456
 *                 captchaToken: 0.turnstile-token-here...
 *     responses:
 *       200:
 *         description: Login successful or 2FA required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid email, password or CAPTCHA verification failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/login', authLimiter, schemaValidate(LoginWithCaptchaSchema, "body"), login);

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

/**
 * @swagger
 * /auth/forgot:
 *   post:
 *     summary: Request password reset
 *     description: Send password reset email with CAPTCHA verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - captchaToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               captchaToken:
 *                 type: string
 *                 description: Turnstile CAPTCHA token from frontend
 *                 example: 0.YrtN-ZR7C6jQVaBM094G1svS2_vSBLgJ-j42Q88orLh82SZnIMgetcLVw790_hCTBXwzvaRdAZjasfc2...
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: CAPTCHA verification failed, pending request, or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Email not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/forgot', schemaValidate(EmailWithCaptchaSchema, "body"), forgot)
authRouter.post('/reset-password', schemaValidate(ResetForgotPasswordSchema, 'validate'), resetPassword)
// Dùng mỗi cho việc verify tài khoản của người dùng
authRouter.post('/register/verify-email', verifyMail) // sẽ gửi jwt chứa các loại thông tin đến, tùy vào type sẽ validate thông tin của người dùng

/**
 * @swagger
 * /api/v1/auth/sso/{provider}:
 *   post:
 *     tags: [Authentication]
 *     summary: SSO Login with Google or Facebook
 *     description: Authenticate user with SSO provider (Google/Facebook). No CAPTCHA required.
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         description: SSO provider (google or facebook)
 *         schema:
 *           type: string
 *           enum: [google, facebook]
 *           example: google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: OAuth access token from provider
 *                 example: "ya29.a0ARrdaM-..."
 *               idToken:
 *                 type: string
 *                 description: OAuth ID token from provider (for Google)
 *                 example: "eyJhbGciOiJSUzI1NiIs..."
 *             oneOf:
 *               - required: [accessToken]
 *               - required: [idToken]
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               data:
 *                 accessToken: "eyJhbGciOiJIUzI1NiIs..."
 *         headers:
 *           Set-Cookie:
 *             description: Authentication cookies
 *             schema:
 *               type: string
 *       200:
 *         description: 2FA required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "2FA required"
 *                 data:
 *                   type: object
 *                   properties:
 *                     2FA Token:
 *                       type: string
 *                     requiresTwoFactor:
 *                       type: boolean
 *                       example: true
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         userName:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Invalid provider, missing token, or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid token or authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already in use by another account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post('/sso/:provider', loginSSO)
authRouter.post('/re-authenticate', authenticate, reAuthenticate)
// Route này dùng cho việc verify sso access token only
// authRouter.post('/sso/:provider/verify')
authRouter.get('/me', authenticate, checkSession)
// cần check lại resend
authRouter.post('/resend/:type', redisValidate((req) => req.params.type, cookieHelper.getServiceGmail), resendVerifyEmail)
authRouter.post('/logout-all', authenticate, removeAllDevices)

authRouter.post('/2fa/login/verify', authenticate2FA, schemaValidate(twoFactorSchema, "body"), twoFactorVerify )
authRouter.post('/2fa/login/backup-codes/verify', authenticate2FA,schemaValidate(twoFactorSchema, "body"), twoFactorBackupCodeVerify)
// Dùng để xác nhập otp từ authenticator app
authRouter.post('/2fa/verify', schemaValidate(twoFactorSchema, "body"), authenticate, twoFactorVerify)
// Sử dụng backup code để verify ( Trường hợp user không available trong tài khoản => không cần authenticate)
authRouter.post('/2fa/backup-codes/verify', authenticate,schemaValidate(twoFactorSchema, "body"),  twoFactorBackupCodeVerify)
// Regen backup codes, vô hiệu hóa tất cả backup codes cũ
authRouter.post('/2fa/backup-codes/regenerate', authenticate, twoFactorBackupCodeRegenerate)
// router.post('/facebook/callback', 

module.exports = authRouter;
