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
const { ResetPasswordSchema, RegisterNewUserSchema, ResetForgotPasswordSchema, EmailSchema, LoginSchema, twoFactorSchema } = require('../utils/schema');
const { redisValidate } = require('../utils/validate');
const cookieHelper = require('../utils/cookieHelper');
const authRouter = express.Router();

// INAVAILABLE USER
authRouter.post('/register/check-email', schemaValidate(EmailSchema, "body"), checkEmailExists)
authRouter.post('/register', redisValidate('register', cookieHelper.getServiceGmail), schemaValidate(RegisterNewUserSchema, "body"), register);
// Dùng mỗi cho việc verify tài khoản của người dùng
authRouter.post('/register/verify-email', verifyMail) // sẽ gửi jwt chứa các loại thông tin đến, tùy vào type sẽ validate thông tin của người dùng


authRouter.post('/sso/:provider', loginSSO)
authRouter.post('/login', authLimiter, schemaValidate(LoginSchema, "body"), login);

authRouter.post('/forgot', schemaValidate(EmailSchema, "body"), redisValidate('forgot',cookieHelper.getServiceGmail), forgot)
authRouter.post('/reset-password', schemaValidate(ResetForgotPasswordSchema, 'validate'), resetPassword)

authRouter.post('/resend/:type', redisValidate((req) => req.params.type, cookieHelper.getServiceGmail), resendVerifyEmail)
// AVAILABLE USER
authRouter.post('/change-password', authenticate, schemaValidate(ResetPasswordSchema, "body"), changePassword);
authRouter.post('/refresh', refreshToken);
authRouter.get('/me/profile', authenticate, getProfile);
authRouter.put('/me/profile', authenticate, updateProfile);
// Route này dùng cho việc verify sso access token only
// authRouter.post('/sso/:provider/verify')
authRouter.post('/re-authenticate', authenticate, reAuthenticate)
authRouter.get('/me', authenticate, checkSession)
// cần check lại resend

authRouter.post('/2fa/login/verify', authenticate2FA, schemaValidate(twoFactorSchema, "body"), twoFactorVerify )
authRouter.post('/2fa/login/backup-codes/verify', authenticate2FA,schemaValidate(twoFactorSchema, "body"), twoFactorBackupCodeVerify)
// Dùng để xác nhập otp từ authenticator app
authRouter.post('/2fa/verify', schemaValidate(twoFactorSchema, "body"), authenticate, twoFactorVerify)
// Sử dụng backup code để verify ( Trường hợp user không available trong tài khoản => không cần authenticate)
authRouter.post('/2fa/backup-codes/verify', authenticate,schemaValidate(twoFactorSchema, "body"),  twoFactorBackupCodeVerify)
// Regen backup codes, vô hiệu hóa tất cả backup codes cũ
authRouter.post('/2fa/backup-codes/regenerate', authenticate, twoFactorBackupCodeRegenerate)
// router.post('/facebook/callback', 
authRouter.post('/logout', authenticate, logout);
authRouter.post('/logout-all', authenticate, removeAllDevices)

module.exports = authRouter;
