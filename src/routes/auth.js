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
const { schemaValidate, redisValidate } = require("../middleware/validate");
const AuthValidators = require("../validators/authValidators");
const cookieHelper = require("../utils/cookieHelper");
const authRouter = express.Router();

authRouter.post(
  "/register",
  schemaValidate(AuthValidators.RegisterNewUserSchema, "body"),
  register
);
// authRouter.post(
//   "/register/check-email",
//   schemaValidate(AuthValidators.EmailWithCaptchaSchema, "body"),
//   checkEmailExists
// );
authRouter.post(
  "/login",
  authLimiter,
  schemaValidate(AuthValidators.LoginWithCaptchaSchema, "body"),
  login
);
authRouter.post("/refresh", refreshToken);
authRouter.post("/logout", logout); // Bỏ authenticate middleware vì đã check cookie trong controller

authRouter.get("/profile", authenticate, getProfile);
authRouter.put("/profile", authenticate, updateProfile);
authRouter.post(
  "/change-password",
  authenticate,
  schemaValidate(AuthValidators.ResetPasswordSchema, "body"),
  changePassword
);
authRouter.post(
  "/forgot",
  schemaValidate(AuthValidators.EmailWithCaptchaSchema, "body"),
  forgot
);
authRouter.post(
  "/reset-password",
  schemaValidate(AuthValidators.ResetForgotPasswordSchema, "validate"),
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
  schemaValidate(AuthValidators.twoFactorSchema, "body"),
  twoFactorVerify
);
authRouter.post(
  "/2fa/login/backup-codes/verify",
  authenticate2FA,
  schemaValidate(AuthValidators.twoFactorSchema, "body"),
  twoFactorBackupCodeVerify
);
authRouter.post(
  "/2fa/verify",
  schemaValidate(AuthValidators.twoFactorSchema, "body"),
  authenticate,
  twoFactorVerify
);
authRouter.post(
  "/2fa/backup-codes/verify",
  authenticate,
  schemaValidate(AuthValidators.twoFactorSchema, "body"),
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
