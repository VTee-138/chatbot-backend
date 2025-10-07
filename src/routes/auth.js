const express = require("express");
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
  reAuthenticate,
  googleOAuthRedirect,
  googleOAuthCallback,
  debugCookies,
} = require("../controllers/authController");
const {
  authenticate,
  isAccountForgotExists,
  authLimiter,
  authenticate2FA,
} = require("../middleware/auth");
const schemaValidate = require("../utils/schemaValidate");
const {
  ResetPasswordSchema,
  RegisterNewUserSchema,
  RegisterWithEmailSchema,
  ResetForgotPasswordSchema,
  EmailSchema,
  LoginSchema,
  LoginWithCaptchaSchema,
  twoFactorSchema,
  EmailWithCaptchaSchema,
} = require("../utils/schema");
const { redisValidate } = require("../utils/validate");
const cookieHelper = require("../utils/cookieHelper");
const authRouter = express.Router();

authRouter.post(
  "/register",
  schemaValidate(RegisterWithEmailSchema, "body"),
  register
);
authRouter.post(
  "/register/check-email",
  schemaValidate(EmailWithCaptchaSchema, "body"),
  checkEmailExists
);
authRouter.post(
  "/login",
  authLimiter,
 // schemaValidate(LoginWithCaptchaSchema, "body"),
  login
);
authRouter.post("/refresh", refreshToken);
authRouter.post("/logout", logout); // Bỏ authenticate middleware vì đã check cookie trong controller

authRouter.get("/profile", authenticate, getProfile);
authRouter.put("/profile", authenticate, updateProfile);
authRouter.post(
  "/change-password",
  authenticate,
  schemaValidate(ResetPasswordSchema, "body"),
  changePassword
);
authRouter.post(
  "/forgot",
  schemaValidate(EmailWithCaptchaSchema, "body"),
  forgot
);
authRouter.post(
  "/reset-password",
  schemaValidate(ResetForgotPasswordSchema, "validate"),
  resetPassword
);
authRouter.post("/register/verify-email", verifyMail);
authRouter.get("/google", googleOAuthRedirect);
authRouter.get("/google/callback", googleOAuthCallback);

authRouter.post("/sso/:provider", loginSSO);
authRouter.post("/re-authenticate", authenticate, reAuthenticate);

authRouter.get("/me", authenticate, checkSession);
authRouter.post(
  "/resend/:type",
  redisValidate((req) => req.params.type, cookieHelper.getServiceGmail),
  resendVerifyEmail
);
authRouter.post("/logout-all", authenticate, removeAllDevices);

authRouter.post(
  "/2fa/login/verify",
  authenticate2FA,
  schemaValidate(twoFactorSchema, "body"),
  twoFactorVerify
);
authRouter.post(
  "/2fa/login/backup-codes/verify",
  authenticate2FA,
  schemaValidate(twoFactorSchema, "body"),
  twoFactorBackupCodeVerify
);
authRouter.post(
  "/2fa/verify",
  schemaValidate(twoFactorSchema, "body"),
  authenticate,
  twoFactorVerify
);
authRouter.post(
  "/2fa/backup-codes/verify",
  authenticate,
  schemaValidate(twoFactorSchema, "body"),
  twoFactorBackupCodeVerify
);
authRouter.post(
  "/2fa/backup-codes/regenerate",
  authenticate,
  twoFactorBackupCodeRegenerate
);

// Debug endpoint (development only)
authRouter.get("/debug/cookies", debugCookies);

module.exports = authRouter;
