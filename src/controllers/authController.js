const { hashPassword, comparePassword, generateApiKey, createShield, convertToAscii } = require('../utils/crypto');
const { generateTokenPair, generateToken, decodePayload, verifyToken } = require('../utils/jwt');
const { successResponse, errorResponse, catchAsync, httpOnlyRevoke, httpOnlyResponse } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');
const { sendEmailToVerify } = require('../utils/mailService');
const { EmailType, HtmlConverter, EmailTypeList } = require('../utils/mailConverter');
const userCredentialModel = require('../model/userCredentialModel')
const { Constants, ErrorResponse } = require('../utils/constant');
const authService = require('../services/authService');
const config = require('../config');
const cookieHelper = require('../utils/cookieHelper');
const TwoFAService = require('../services/2FAService');
const { getConnectionName } = require('ioredis/built/cluster/util');
const { rateLimiterAuth, rateLimiterGeneral } = require('../config/limiter');
const { twoFactorEnable } = require('./userController');
const logger = require('../utils/logger');
/**
 * Verify Email Sent
 */
const verifyMail = catchAsync(async (req, res, next) => {
  const { jwt } = req.body
  try {
      const user = verifyToken(jwt, 'validate')
      await userCredentialModel.updateVerifiedByEmail(user.email)
      await redis.del(`register:${user.email}`)
      httpOnlyRevoke(res, "registerEmail")
      return successResponse(res, "Successful", 200)
  } catch (error) {
      if (error.name === 'TokenExpiredError') {
          return errorResponse(res, 'Token has expired', Constants.BAD_REQUEST)
      }
      if (error.name === 'JsonWebTokenError') {
          return errorResponse(res, 'Invalid token', Constants.BAD_REQUEST)
      }
      next(error)
  }
})
/**
 * Register new user
 */
const register = catchAsync(async (req, res, next) => {
  try {
    const { email, userName, password, phoneNumber, captchaToken } = req.body;
    
    // Import turnstile service
    const { verifyTurnstileToken } = require('../services/turnstileService');
    
    // Verify CAPTCHA token first
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, req.ip);
    if (!isCaptchaValid) {
      return errorResponse(res, 'CAPTCHA verification failed', Constants.BAD_REQUEST);
    }
    
    // Check if there's already a pending verification email for this email
    const pendingVerification = await redis.get(`register:${email}`);
    if (pendingVerification) {
      return errorResponse(res, 'Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!', Constants.BAD_REQUEST);
    }
    
    // Check if user already exists
    const existingUser = await userCredentialModel.findUserByEmail(email)
    if (existingUser && existingUser.emailVerifiedAt) {
      return errorResponse(res, 'Tài khoản đã tồn tại', Constants.CONFLICT);
    }
      
    // Check username exists?
    const checker = await userCredentialModel.findAccountWithUserName(userName)
    if (checker) return errorResponse(res, 'Tên người dùng đã tồn tại', Constants.BAD_REQUEST)
        
    // Hash password
    const hashedPassword = await hashPassword(password);
    const newUser = {
      email: email,
      passwordHash: hashedPassword.valueOf(),
      phoneNumber: phoneNumber,
      userName: userName
    }
    await userCredentialModel.registerNewUser(newUser)
        
    const validateToken = generateToken({email: email}, 'validate')
    await redis.set(`register:${email}`, validateToken, 'EX', Constants.TIME_PICKER._120secs)
    
    // Send email to verify
    try {
      await sendEmailToVerify(EmailType.REGISTER, config.URL_MAIL_PUBLIC, validateToken, email, '🚀 Link xác thực tài khoản đăng ký đã tới!', HtmlConverter.Register)
      
      const message = config.NODE_ENV === 'development'
        ? 'Đã đăng ký tài khoản thành công! (Development mode - check server logs for verification email)'
        : 'Đã đăng ký tài khoản thành công! Hãy vào email để xác thực tài khoản của bạn'
      
      return successResponse(res, message, 200);
    } catch (emailError) {
      console.error("Registration email failed:", emailError)
      
      const message = config.NODE_ENV === 'development'
        ? 'Tài khoản đã được tạo nhưng có lỗi email service. Check server logs for verification token.'
        : 'Tài khoản đã được tạo. Nếu không nhận được email xác thực, vui lòng thử lại sau.'
      
      return successResponse(res, message, 200);
    }
  } catch (error) {
    next(error)
  }
});
/**
 * 
 */
const checkEmailExists = catchAsync ( async ( req, res ) =>{
  const { email, captchaToken } = req.body
  try {
    // Import turnstile service
    const { verifyTurnstileToken } = require('../services/turnstileService');
    
    // Verify CAPTCHA token
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, req.ip);
    if (!isCaptchaValid) {
      return errorResponse(res, 'CAPTCHA verification failed', Constants.BAD_REQUEST);
    }
    
    const checker = await userCredentialModel.findUserByEmail(email)
    if (checker && checker.emailVerifiedAt) {
      return errorResponse(res, 'User with this email already in use', 409);
    }
    httpOnlyResponse(res,"registerEmail", email, Constants.TIME_PICKER._1hour_ms)
    return successResponse(res, "Successful")
  } catch (error) {
    console.error(error)
    return errorResponse(res, "Failed")
  }
})
/**
 * Login user
 * Có 2 case mà client sẽ phải gọi đến api này
 * - Người mới tạo tài khoản xong, chưa đăng nhập, chưa tồn tại bất cứ session Id nào trong db
 * - Người dùng đã log out => mất session db, nên phải login lại từ đầu
 */
const login = catchAsync(async (req, res, next) => {
  // GET FIELD
  const { email, password, captchaToken } = req.body;
  try {
    // Import turnstile service
    const { verifyTurnstileToken } = require('../services/turnstileService');
    
    // Verify CAPTCHA token first
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, req.ip);
    if (!isCaptchaValid) {
      return errorResponse(res, 'CAPTCHA verification failed', Constants.BAD_REQUEST);
    }
    
    // Find user with password by email
    const user = await userCredentialModel.findUserByEmail(email)
    // Tài khoản sso sẽ có một email vậy nên nếu không tồn tại mật khẩu => không cho đăng nhập
    if (!user || !user.emailVerifiedAt || !user.passwordHash) {
      return errorResponse(res, 'Email hoặc mật khẩu không hợp lệ', Constants.BAD_REQUEST);
    }
    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse(res, 'Email hoặc mật khẩu không hợp lệ', Constants.BAD_REQUEST);
    }
    // Nếu 2FA có bật, tạo token mới để xác nhận việc xác nhận 2FA
    if (user.twoFactorEnabled) {
      const payload = {
        id: user.id,
        role: user.role
      }
      const mfaToken = generateToken(payload, '2fa')
      return successResponse(res, { "2FA Token": mfaToken }, "2FA required", Constants.OK)
    }
    req.user = user
    return openSession(req, res, next)
  } catch (error) {                                             
    next(error)
  }
});
/**
 * @description Refresh access token, xác thực refresh token thông qua req.session, vì đã lưu
 * thông tin của nó trong session khi tạo tài khoản ban đầu
 * Khi người dùng thoát khỏi browser mà vào lại, thì client sẽ gọi đến đây
 * Request đến đây sẽ check client request httpOnly Cookie, xem liệu người dùng này có tồn tại trong session hay không
 * 
 * @cases Có 2 case mà người dùng sẽ gọi đến controller này:
 * - Hết hạn access token được lưu trong memory client, nhưng vẫn còn hạn refresh token 
 * - Persistent logging khi người dùng đăng nhập mà thoát browser, khi quay lại dù access_token hết hạn nhưng vẫn tồn tại session => pass
 */
const refreshToken = catchAsync(async (req, res) => {
  // Get user's cookies
  const cookieRefreshToken = req.cookies.refreshToken
  const cookieClientInformation = req.cookies.clientInformation

  logger.log('🔄 Refresh token attempt');
  logger.debug('🍪 All cookies received:', Object.keys(req.cookies));
  logger.debug('📋 RefreshToken cookie:', cookieRefreshToken ? 'EXISTS' : 'MISSING');
  logger.debug('📋 ClientInformation cookie:', cookieClientInformation ? 'EXISTS' : 'MISSING');

  // Check missing cookies
  if (!cookieRefreshToken) {
    logger.error('❌ Missing refresh token cookie');
    return errorResponse(res, 'Refresh token not found. Please login again.', 401);
  }

  if (!cookieClientInformation) {
    logger.error('❌ Missing client information cookie');
    return errorResponse(res, 'Client information not found. Please login again.', 401);
  }

  let cookieUserInformation;
  try {
    cookieUserInformation = JSON.parse(cookieClientInformation);
  } catch (parseError) {
    logger.error('❌ Failed to parse client information:', parseError.message);
    return errorResponse(res, 'Invalid client information format', 400);
  }
  
  try {
    // Validate user information structure
    if (!cookieUserInformation.id || !cookieUserInformation.email || !cookieUserInformation.userName) {
      logger.error('❌ Invalid user information structure');
      return errorResponse(res, 'Invalid user session data', 400);
    }

    logger.debug(`🔍 Checking refresh token for user: ${cookieUserInformation.userName} (${cookieUserInformation.id})`);

    // Check Redis with better error handling
    let storedHashedToken;
    try {
      storedHashedToken = await redis.get(`refresh:${cookieUserInformation.id}`)
    } catch (redisError) {
      // Redis connection error - critical
      logger.error('❌ Redis connection error:', redisError.message);
      return errorResponse(res, 'Service temporarily unavailable. Please try again.', 503);
    }
    
    if (!storedHashedToken) {
      logger.error('❌ No refresh token found in Redis for user:', cookieUserInformation.id);
      
      // Clear invalid cookies
      httpOnlyRevoke(res, "refreshToken");
      httpOnlyRevoke(res, "clientInformation");
      
      return errorResponse(res, 'Session expired. Please login again.', 401);
    }

    const isValidRefreshToken = await comparePassword(cookieRefreshToken, storedHashedToken)
    if (!isValidRefreshToken) {
      logger.error('❌ Refresh token verification failed for user:', cookieUserInformation.id);
      
      // Clear invalid cookies and Redis entry
      httpOnlyRevoke(res, "refreshToken");
      httpOnlyRevoke(res, "clientInformation");
      
      try {
        await redis.del(`refresh:${cookieUserInformation.id}`);
      } catch (redisError) {
        logger.warn('⚠️ Failed to delete refresh token from Redis:', redisError.message);
        // Continue - not critical
      }
      
      return errorResponse(res, 'Invalid refresh token. Please login again.', 401);
    }

    logger.log('✅ Refresh token verified, generating new tokens...');

    // Get fresh user data from database to ensure accuracy
    const user = await prisma.user.findUnique({
      where: { id: cookieUserInformation.id },
      select: {
        id: true,
        email: true,
        userName: true,
        role: true
      }
    });

    if (!user) {
      logger.error('❌ User not found:', cookieUserInformation.id);
      
      // Clear cookies and Redis entry for non-existent user
      httpOnlyRevoke(res, "refreshToken");
      httpOnlyRevoke(res, "clientInformation");
      try {
        await redis.del(`refresh:${cookieUserInformation.id}`);
      } catch (redisError) {
        logger.warn('⚠️ Failed to delete from Redis:', redisError.message);
      }
      
      return errorResponse(res, 'User account not found. Please login again.', 401);
    }

    // Get user's SSO providers
    const ssoProviders = await prisma.ssoAccount.findMany({
      where: { userId: user.id },
      select: { provider: true }
    });

    // Get user's groups for updated payload
    const userGroups = await prisma.group_members.findMany({
      where: { userId: user.id },
      include: {
        groups: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let needsOnboarding = userGroups.length === 0;
    let activeGroup = null;

    if (userGroups.length > 0) {
      activeGroup = {
        id: userGroups[0].groups.id,
        name: userGroups[0].groups.name,
        role: userGroups[0].role,
        slug: userGroups[0].groups.slug
      };
    }

    // Create updated payload with fresh data
    const updatedPayload = {
      id: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
      ssoProviders: ssoProviders.map(s => s.provider),
      needsOnboarding,
      activeGroup,
      groupCount: userGroups.length
    };

    // Generate new token pair
    const tokens = generateTokenPair(updatedPayload);

    // Hash and store new refresh token in Redis
    const newHashedToken = await hashPassword(tokens.refreshToken)
    await redis.set(`refresh:${user.id}`, newHashedToken.valueOf(), 'EX', Constants.TIME_PICKER._7day_secs)

    // Update cookies with new tokens and fresh user data
    httpOnlyResponse(res, "refreshToken", tokens.refreshToken, Constants.TIME_PICKER._7day_ms)
    httpOnlyResponse(res, "clientInformation", JSON.stringify(updatedPayload), Constants.TIME_PICKER._7day_ms)

    console.log(`✅ Access token refreshed successfully for user: ${user.userName}`);

    return successResponse(res, {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        needsOnboarding,
        activeGroup,
        groupCount: userGroups.length
      }
    }, 'Token refreshed successfully');
  } catch (err) {
    console.error('❌ Refresh token error:', err.message);
    console.error('❌ Error stack:', err.stack);
    
    // Clear cookies on any error
    httpOnlyRevoke(res, "refreshToken");
    httpOnlyRevoke(res, "clientInformation");
    
    return errorResponse(res, 'Failed to refresh token. Please login again.', 500);
  }
});


/**
 * Forgot password account
 */
const forgot = catchAsync( async(req, res, next) =>{
  const { email, captchaToken } = req.body
  try {
    // Import turnstile service
    const { verifyTurnstileToken } = require('../services/turnstileService');
    
    // Verify CAPTCHA token first
    const isCaptchaValid = await verifyTurnstileToken(captchaToken, req.ip);
    if (!isCaptchaValid) {
      return errorResponse(res, 'CAPTCHA verification failed', Constants.BAD_REQUEST);
    }
    
    // Check if there's already a pending forgot password email for this email
    const pendingForgot = await redis.get(`forgot:${email}`);
    if (pendingForgot) {
      return errorResponse(res, 'Vui lòng kiểm tra mail xác nhận để kích hoạt tài khoản!', Constants.BAD_REQUEST);
    }
    
    // Verify có phải là một tài khoản Credential chính thức không
    await authService.validateForgotAccount(email)
    // Tạo token
    const token = generateToken({email}, 'validate')
    await redis.set(`forgot:${email}`, token, 'EX', Constants.TIME_PICKER._120secs)
    httpOnlyResponse(res, "forgotEmail", email, Constants.TIME_PICKER._1hour_ms)
    
    try {
      // Send email
      await sendEmailToVerify(EmailType.FORGOT, config.URL_MAIL_PUBLIC, token, email, '🚀 Link xác nhận quên mật khẩu đã tới!', HtmlConverter.Forgot)
      
      const message = config.NODE_ENV === 'development' 
        ? 'Yêu cầu đã được xử lý thành công! (Development mode - check server logs for email content)'
        : 'Đã xác nhận yêu cầu thay đổi mật khẩu mới thành công! Vui lòng xác nhận yêu cầu trong email của bạn!'
      
      return successResponse(res, message, 200)
    } catch (emailError) {
      console.error("Email sending failed:", emailError)
      // Vẫn trả về success vì đã lưu token, có thể retry sau
      const message = config.NODE_ENV === 'development'
        ? 'Yêu cầu đã được xử lý nhưng có lỗi email service. Check server logs.'
        : 'Yêu cầu đã được xử lý. Nếu không nhận được email, vui lòng thử lại sau.'
      
      return successResponse(res, message, 200)
    }
  } catch (error) {
    console.error("Forgot password error:", error)
    next(error)
  }
})
/**
 * Logout user
 */
const logout = catchAsync(async (req, res) => {
  console.log('🚪 Logout request received');
  
  try {
    // Get user ID from cookies or auth token
    const id = cookieHelper.getClientId(req);
    
    if (id) {
      console.log(`🔄 Cleaning up session for user: ${id}`);
      
      // Delete refresh token from Redis
      await redis.del(`refresh:${id}`);
      console.log('✅ Refresh token deleted from Redis');
      
      // Delete any other user-related cache
      await redis.del(`session:${id}`);
      await redis.del(`2fa:${id}`);
      
      // Clear rate limiting data for this IP
      rateLimiterAuth.delete(req.ip);
      rateLimiterGeneral.delete(req.ip);
    } else {
      console.log('⚠️ No user ID found in cookies, clearing cookies anyway');
    }
    
    // Clear all auth-related cookies
    httpOnlyRevoke(res, "refreshToken");
    httpOnlyRevoke(res, "clientInformation");
    httpOnlyRevoke(res, "activeGroup");
    httpOnlyRevoke(res, "forgotEmail");
    httpOnlyRevoke(res, "registerEmail");
    
    console.log('✅ All cookies cleared');
    console.log('✅ Logout completed successfully');
    
    return successResponse(res, null, 'Logout successful');
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Even if there's an error, still clear cookies
    httpOnlyRevoke(res, "refreshToken");
    httpOnlyRevoke(res, "clientInformation");
    httpOnlyRevoke(res, "activeGroup");
    return successResponse(res, null, 'Logout completed with errors');
  }
});

/**
 * Get current user profile
 */
const getProfile = catchAsync(async (req, res) => {
  console.log('🔍 getProfile called with req.user:', req.user);
  
  if (!req.user || !req.user.id) {
    return errorResponse(res, 'User information not found in request', 400);
  }

  // Always get real user from database - no more mock users
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      userName: true,
      avatarUrl: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      twoFactorBackupCodes: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });

  if (!user) {
    console.error(`❌ User not found in database with ID: ${req.user.id}`);
    return errorResponse(res, 'User not found in database', 404);
  }

  console.log(`✅ Found user in database: ${user.userName} (${user.email})`);

  // Get user's groups
  const userGroups = await prisma.group_members.findMany({
    where: { userId: user.id },
    include: {
      groups: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  console.log(`📁 User has ${userGroups.length} groups`);

  // Get SSO providers
  const ssoProviders = await prisma.ssoAccount.findMany({
    where: { userId: user.id },
    select: { provider: true }
  });

  console.log(`🔗 User has SSO providers: ${ssoProviders.map(s => s.provider).join(', ')}`);

  const profileData = {
    ...user,
    groups: userGroups.map(m => ({
      ...m.groups,
      role: m.role
    })),
    ssoProviders: ssoProviders.map(s => s.provider),
    needsOnboarding: userGroups.length === 0
  };
  
  console.log(`✅ Returning full profile for user: ${user.userName}`);
  return successResponse(res, profileData, 'Profile retrieved successfully');
});

/**
 * Update user profile
 */
const updateProfile = catchAsync(async (req, res) => {
  const { firstName, lastName, avatar } = req.body;
  
  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      lastName,
      avatar,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      updatedAt: true,
    },
  });
  
  return successResponse(res, updatedUser, 'Profile updated successfully');
});

/**
 * Change password
 */
const changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const clientId = cookieHelper.getClientId(req)
  // Get user with password
  const user = await userCredentialModel.findUserById(clientId)
  console.log(user)
  // Verify current password
  const isCurrentPasswordValid = await comparePassword(oldPassword, user.passwordHash);
  
  if (!isCurrentPasswordValid) {
    return errorResponse(res, 'Incorrect Password', Constants.BAD_REQUEST);
  }
  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);
  // Update password
  await userCredentialModel.updatePasswordByID(clientId, hashedNewPassword.valueOf())
  return successResponse(res, null, 'Password changed successfully');
});

const resendVerifyEmail = catchAsync(async (req, res, next) =>{
  // GET FIELDS
  try {
    const { type } = req.params
    const { jwt, token } = req.body
    const authToken = token || jwt; // Support both formats
    const email = cookieHelper.getServiceGmail(req)
    
    if (!EmailTypeList.includes(type)) {
      return errorResponse(res, 'Invalid type params', Constants.BAD_REQUEST)
    }
    
    if (!authToken) {
      return errorResponse(res, 'Token is required', Constants.BAD_REQUEST)
    }
  
    // SET CONTENT TO SEND MAIL
    const subject = type == EmailType.FORGOT? '🚀 Link xác nhận quên mật khẩu đã tới!': '🚀 Link xác thực tài khoản đăng ký đã tới!'
    const htmlConverter = type == EmailType.FORGOT? HtmlConverter.Forgot: HtmlConverter.Register
    
    const { iat, exp, ...decodedInformation } = verifyToken(authToken, "validate")
    const newToken = generateToken( decodedInformation, 'validate')
    await redis.set(`${type}:${email}`, newToken, 'EX', Constants.TIME_PICKER._120secs)
    
    // Send Email
    await sendEmailToVerify(type, config.URL_MAIL_PUBLIC, newToken, email, subject, htmlConverter)
    return successResponse(res, 'Đã nhận được yêu cầu của bạn, vui lòng xác nhận trong email!', 200)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired', Constants.BAD_REQUEST)
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token', Constants.BAD_REQUEST)
    }
    next(error)
  }
})
const resetPassword = catchAsync( async (req, res, next) => {
  try {
    // Support both 'token' and 'jwt' for compatibility
    const { token, jwt, newPassword, confirmPassword } = req.body
    const authToken = token || jwt; // Use 'token' if available, fallback to 'jwt'
    
    if (!authToken) {
      return errorResponse(res, 'Token is required', Constants.BAD_REQUEST);
    }
    
    if (!newPassword) {
      return errorResponse(res, 'New password is required', Constants.BAD_REQUEST);
    }
    
    // Optional: validate confirmPassword if provided
    if (confirmPassword && newPassword !== confirmPassword) {
      return errorResponse(res, 'Passwords do not match', Constants.BAD_REQUEST);
    }
    
    // Verify and decode the token
    const { email } = verifyToken(authToken, 'validate')
    
    // Check if token is still valid in Redis
    const redisToken = await redis.get(`forgot:${email}`);
    if (!redisToken) {
      return errorResponse(res, 'Token has expired or is invalid', Constants.BAD_REQUEST);
    }
    
    // Clean up: remove the used token
    await redis.del(`forgot:${email}`)
    
    // Hash and update password
    const hashedNewPassword = await hashPassword(newPassword);
    await userCredentialModel.updatePassword(email, hashedNewPassword.valueOf())
    
    // Clean up cookies
    httpOnlyRevoke(res, "forgotEmail")
    
    return successResponse(res, 'Password reset successfully', 200)
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Reset token has expired', Constants.BAD_REQUEST)
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid reset token', Constants.BAD_REQUEST)
    }
    next(error)
  }
})
const openSession = catchAsync ( async (req, res, next) => {
  try {
    const user = req.user
    console.log(user)
    if (!user) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
    
    // Get SSO providers
    const ssoUsers = await userCredentialModel.findSSOUserById(user.id);
    const ssoProviders = (ssoUsers || []).map(s => s.provider);
    
    // Get user's groups and check if they need to create first group
    const userGroups = await prisma.group_members.findMany({
      where: { userId: user.id },
      include: {
        groups: {
          include: {
            subscriptions: {
              include: { plans: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    let needsOnboarding = false;
    let activeGroup = null;
    
    if (userGroups.length === 0) {
      // User chưa có group nào - cần onboarding
      needsOnboarding = true;
    } else {
      // Set group đầu tiên làm active group mặc định
      activeGroup = {
        id: userGroups[0].groups.id,
        name: userGroups[0].groups.name,
        role: userGroups[0].role,
        slug: userGroups[0].groups.slug
      };
    }
  
    const clientPayload = {
      id: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
      ssoProviders,
      needsOnboarding,
      activeGroup,
      groupCount: userGroups.length
    };
  
    const tokens = generateTokenPair(clientPayload);
  
    // Hash refresh token lưu vào Redis
    const hashed = await hashPassword(tokens.refreshToken);
    await redis.set(`refresh:${user.id}`, hashed, 'EX', Constants.TIME_PICKER._7day_secs);
  
    // Gửi cookies xuống client
    // IMPORTANT: Set accessToken cookie cho middleware có thể check
    httpOnlyResponse(res, 'accessToken', tokens.accessToken, Constants.TIME_PICKER._15mins_ms);
    httpOnlyResponse(res, 'refreshToken', tokens.refreshToken, Constants.TIME_PICKER._7day_ms);
    httpOnlyResponse(res, 'clientInformation', JSON.stringify(clientPayload), Constants.TIME_PICKER._7day_ms);
    
    // Set active group cookie if available
    if (activeGroup) {
      httpOnlyResponse(res, 'activeGroup', JSON.stringify(activeGroup), Constants.TIME_PICKER._7day_ms);
    }
  
    return successResponse(res, { 
      accessToken: tokens.accessToken, // Vẫn trả về trong response để frontend có thể dùng
      needsOnboarding,
      activeGroup,
      groupCount: userGroups.length
    }, 'Login successful');
  } catch (error) {
    next(error)
  }
}) 

const createSSO = catchAsync (async (req, res) => {
  // Get Fields
  const { provider } = req.params.provider
  const userInput = req.body
  const sub = req.cookies.sub
  try {
    // Update SSO Account 
    await userCredentialModel.updateSSOAccount(provider, sub, userInput)
    return successResponse(res, "Successful")
  } catch (error) {
    throw error
  }
})

/**
 * Generate Google OAuth URL
 */
const generateGoogleOAuthUrl = (state = null) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
  const options = {
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: `${config.BASE_URL || 'http://localhost:8000'}/api/v1/auth/google/callback`,
    scope: 'openid profile email',
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent'
  }
  
  if (state) {
    options.state = state
  }
  
  const qs = new URLSearchParams(options)
  return `${rootUrl}?${qs.toString()}`
}

/**
 * Google OAuth Redirect
 */
const googleOAuthRedirect = catchAsync(async (req, res) => {
  // Generate state parameter for security
  const state = Math.random().toString(36).substring(2, 15)
  
  // Store state in Redis for verification (optional)
  await redis.set(`oauth_state:${state}`, req.ip, 'EX', 600) // 10 minutes
  
  const googleAuthUrl = generateGoogleOAuthUrl(state)
  console.log('🔗 Redirecting to Google OAuth:', googleAuthUrl)
  
  return res.redirect(googleAuthUrl)
})

/**
 * Google OAuth Callback
 */
const googleOAuthCallback = catchAsync(async (req, res, next) => {
  const { code, state, error } = req.query
  
  try {
    // Handle OAuth errors
    if (error) {
      console.error('Google OAuth error:', error)
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=oauth_error&provider=google`)
    }
    
    if (!code) {
      console.error('Missing authorization code')
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=missing_code`)
    }
    
    // Verify state parameter (optional)
    if (state) {
      const storedState = await redis.get(`oauth_state:${state}`)
      if (storedState) {
        await redis.del(`oauth_state:${state}`)
      }
    }
    
    console.log('📧 Processing Google OAuth callback with code:', code.substring(0, 20) + '...')
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.BASE_URL || 'http://localhost:8000'}/api/v1/auth/google/callback`,
      }),
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`)
    }
    
    const tokens = await tokenResponse.json()
    console.log('🎫 Received Google tokens successfully')
    
    // Use the ID token to get user profile and login
    const idToken = tokens.id_token
    if (!idToken) {
      console.error('Missing ID token in response')
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=missing_id_token`)
    }
    
    // Verify and get user profile from ID token
    let ssoProfile = null
    try {
      ssoProfile = await authService.googleSSOLogin(idToken)
    } catch (ssoError) {
      console.error('Google profile verification failed:', ssoError.message)
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=profile_verification_failed`)
    }
    
    if (!ssoProfile || !ssoProfile.sub) {
      console.error('Failed to get Google profile')
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/login?error=profile_failed`)
    }
    
    console.log(`✅ Google profile verified for user: ${ssoProfile.email}`)
    
    // Check if SSO user already exists
    let ssoUser = await userCredentialModel.findUserBySSO('google', ssoProfile.sub)
    
    // If user doesn't exist, create new SSO account
    if (!ssoUser) {
      console.log('👤 Creating new Google SSO account')
      
      // Generate unique username from profile
      let userName = convertToAscii(ssoProfile.userName || ssoProfile.name || `user_${ssoProfile.sub.slice(-8)}`)
      const newUserName = await authService.generateUniqueUserName(userName)
      
      const email = ssoProfile.email
      
      // Check if email already exists
      if (email) {
        const existingUser = await userCredentialModel.findUserByEmail(email)
        if (existingUser && existingUser.emailVerifiedAt) {
          const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
          return res.redirect(`${frontendUrl}/login?error=email_already_used`)
        }
      }
      
      // Create new SSO account
      try {
        ssoUser = await userCredentialModel.createSSOAccount('google', ssoProfile.sub, {
          userName: newUserName,
          email: email,
          firstName: ssoProfile.firstName || ssoProfile.given_name,
          lastName: ssoProfile.lastName || ssoProfile.family_name,
          avatar: ssoProfile.picture || ssoProfile.avatar
        })
        console.log(`✅ Created new Google account for user: ${newUserName}`)
      } catch (createError) {
        console.error('Failed to create SSO account:', createError)
        const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
        return res.redirect(`${frontendUrl}/login?error=account_creation_failed`)
      }
    } else {
      console.log(`🔄 Existing Google user login: ${ssoUser.userName}`)
    }
    
    // Check if 2FA is enabled
    if (ssoUser.twoFactorEnabled) {
      console.log(`🔒 2FA required for user: ${ssoUser.userName}`)
      const payload = {
        id: ssoUser.id,
        role: ssoUser.role
      }
      const mfaToken = generateToken(payload, '2fa')
      
      // Redirect to frontend with 2FA token
      const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
      return res.redirect(`${frontendUrl}/verify-2fa?token=${mfaToken}&provider=google`)
    }
    
    // Create session for the user
    req.user = ssoUser
    
    // Generate tokens
    const ssoUsers = await userCredentialModel.findSSOUserById(ssoUser.id)
    const ssoProviders = (ssoUsers || []).map(s => s.provider)
    
    const clientPayload = {
      id: ssoUser.id,
      email: ssoUser.email,
      userName: ssoUser.userName,
      role: ssoUser.role,
      ssoProviders
    }
    
    const tokenPair = generateTokenPair(clientPayload)
    
    // Hash refresh token and store in Redis
    const hashed = await hashPassword(tokenPair.refreshToken)
    await redis.set(`refresh:${ssoUser.id}`, hashed, 'EX', Constants.TIME_PICKER._7day_secs)
    
    // Set authentication cookies
    httpOnlyResponse(res, 'refreshToken', tokenPair.refreshToken, Constants.TIME_PICKER._7day_ms)
    httpOnlyResponse(res, 'clientInformation', JSON.stringify(clientPayload), Constants.TIME_PICKER._7day_ms)
    
    console.log(`✅ Google OAuth login successful for: ${ssoUser.userName}`)
    
    // Redirect to OAuth callback page with success status
    const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
    const redirectUrl = `${frontendUrl}/oauth/callback?status=success&provider=google`
    
    return res.redirect(redirectUrl)
    
  } catch (error) {
    console.error('❌ Google OAuth Callback Error:', error.message)
    const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000'
    return res.redirect(`${frontendUrl}/login?error=oauth_callback_error`)
  }
})

const loginSSO = catchAsync( async (req, res, next) => {
  const { provider } = req.params
  const { accessToken, idToken } = req.body
  
  try {
    // Validate provider
    if (!provider || !['google', 'facebook'].includes(provider)) {
      return errorResponse(res, "Phương thức đăng nhập không được hỗ trợ. Vui lòng sử dụng Google hoặc Facebook", Constants.BAD_REQUEST)
    }

    // Validate token - support both accessToken and idToken for Google
    const authToken = accessToken || idToken;
    if (!authToken) {
      return errorResponse(res, `${provider} token is required`, Constants.BAD_REQUEST)
    }
    
    console.log(`🔐 SSO Login attempt with ${provider}`);
    
    // Verify SSO Account based on provider
    let ssoProfile = null;
    try {
      if (provider === 'google') {
        ssoProfile = await authService.googleSSOLogin(authToken);
      } else if (provider === 'facebook') {
        ssoProfile = await authService.facebookSSOLogin(authToken);
      }
    } catch (ssoError) {
      console.error(`${provider} SSO verification failed:`, ssoError.message);
      return errorResponse(res, `Invalid ${provider} token or authentication failed`, Constants.UNAUTHORIZED);
    }

    if (!ssoProfile || !ssoProfile.sub) {
      return errorResponse(res, `Failed to get ${provider} profile information`, Constants.BAD_REQUEST);
    }

    console.log(`✅ ${provider} profile verified for user: ${ssoProfile.email || ssoProfile.sub}`);

    // Check if SSO user already exists
    let ssoUser = await userCredentialModel.findUserBySSO(provider, ssoProfile.sub);

    // If user doesn't exist, create new SSO account
    if (!ssoUser) {
      console.log(`👤 Creating new ${provider} SSO account`);
      
      // Generate unique username from profile
      let userName = convertToAscii(ssoProfile.userName || ssoProfile.name || `user_${ssoProfile.sub.slice(-8)}`);
      const newUserName = await authService.generateUniqueUserName(userName);
      
      // For Google, we get email. For Facebook, email might not be available
      const email = provider === 'google' ? ssoProfile.email : undefined;
      
      // Check if email already exists (for Google accounts)
      if (email) {
        const existingUser = await userCredentialModel.findUserByEmail(email);
        if (existingUser && existingUser.emailVerifiedAt) {
          return errorResponse(res, 'Email đã được sử dụng bởi tài khoản khác', Constants.CONFLICT);
        }
      }

      // Create new SSO account
      try {
        ssoUser = await userCredentialModel.createSSOAccount(provider, ssoProfile.sub, {
          userName: newUserName,
          email: email,
          firstName: ssoProfile.firstName || ssoProfile.given_name,
          lastName: ssoProfile.lastName || ssoProfile.family_name,
          avatar: ssoProfile.picture || ssoProfile.avatar
        });
        console.log(`✅ Created new ${provider} account for user: ${newUserName}`);
      } catch (createError) {
        console.error('Failed to create SSO account:', createError);
        return errorResponse(res, 'Failed to create account', Constants.INTERNAL_SERVER_ERROR);
      }
    } else {
      console.log(`🔄 Existing ${provider} user login: ${ssoUser.userName}`);
    }

    // Check if 2FA is enabled
    if (ssoUser.twoFactorEnabled) {
      console.log(`🔒 2FA required for user: ${ssoUser.userName}`);
      const payload = {
        id: ssoUser.id,
        role: ssoUser.role
      }
      const mfaToken = generateToken(payload, '2fa');
      return successResponse(res, { 
        twoFactorToken: mfaToken,
        "2FA Token": mfaToken, // Keep for backward compatibility
        requiresTwoFactor: true,
        user: {
          id: ssoUser.id,
          userName: ssoUser.userName,
          email: ssoUser.email
        }
      }, "2FA required", Constants.OK);
    }

    // Proceed with normal login - create session
    req.user = ssoUser;
    console.log(`✅ ${provider} login successful for: ${ssoUser.userName}`);
    
    return openSession(req, res, next);
    
  } catch (error) {
    console.error(`❌ SSO Login Error (${provider}):`, error.message);
    next(error);
  }
})
const checkSession = catchAsync ( async ( req, res ) => {
  console.log('🔍 Session check requested');
  console.log('🍪 All cookies:', Object.keys(req.cookies));
  
  // If JWT authentication passed (req.user exists), session is valid
  if (req.user && req.user.id) {
    console.log('✅ Session verified via JWT token for user:', req.user.userName);
    
    // Check if user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    if (!user) {
      console.log('❌ User not found in database');
      return errorResponse(res, "User not found", 404);
    }
    
    console.log('✅ User found in database, session is valid');
    return successResponse(res, { 
      sessionValid: true,
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        role: user.role
      }
    }, "Session is active");
  }
  
  // Fallback: Check cookies (for backward compatibility)
  console.log('⚠️ No JWT token, checking cookies...');
  
  const token = req.cookies.refreshToken;
  const clientInfo = req.cookies.clientInformation;
  
  console.log('📋 Refresh token from cookies:', token ? 'EXISTS' : 'MISSING');
  console.log('📋 Client info from cookies:', clientInfo ? 'EXISTS' : 'MISSING');
  
  if (!token || !clientInfo) {
    console.log('❌ Missing required cookies for session check');
    return errorResponse(res, "No active session found", 401);
  }
  
  let id;
  try {
    const parsed = JSON.parse(clientInfo);
    id = parsed.id;
  } catch (err) {
    console.log('❌ Failed to parse client information');
    return errorResponse(res, "Invalid session data", 400);
  }
  
  const refreshHash = await redis.get(`refresh:${id}`)
  console.log('📋 Redis refresh token:', refreshHash ? 'EXISTS' : 'MISSING');
  
  // Check fields
  if (!refreshHash) return errorResponse(res, "Session not available", Constants.BAD_REQUEST)
  const checker = await comparePassword(token, refreshHash)
  console.log('✅ Session verification:', checker ? 'VALID' : 'INVALID');
  
  // Return
  if (checker) return successResponse(res, { sessionValid: true }, "Session is active")
  else return errorResponse(res, "Session not available", Constants.BAD_REQUEST)
})
const removeAllDevices = catchAsync ( async ( req, res ) => {

})
const twoFactorVerify = catchAsync( async (req, res, next) =>{
  try {
    const { token } = req.body
    const id = req.userId ?? cookieHelper.getClientId(req)
    if (!id) return errorResponse(res, Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
    // Để check xem đây có phải là từ route trước login hay là route sau login
    const is2FALogin = req.mfa
    // Tìm kiếm user trong db để lấy secret 
    const user = await userCredentialModel.findUserById(id)
    console.log(user)
    const checker = TwoFAService.verifyOTP(token, user.twoFactorSecret)
    if (!checker) return errorResponse(res, Constants.MESSAGES._TOKEN_INVALID, Constants.BAD_REQUEST)
    // Nếu từ route login, thì mở session
    if (is2FALogin){ 
      req.user = user
      return openSession(req, res, next)
    }
    return successResponse(res)
  } catch (error) {
    next(error)
  }
})
const twoFactorBackupCodeVerify = catchAsync( async (req, res, next) =>{
  try {
    const { token } = req.body; // token = backup code
    const id = req.userId ?? cookieHelper.getClientId(req)
    if (!id) return errorResponse(res, Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
    const is2FALogin = req.mfa
    // Get 2fa code and secret
    const user = await userCredentialModel.findUserById(id);
    if (!user || !user.twoFactorEnabled) {
      return errorResponse(res, "2FA not Enabled", Constants.BAD_REQUEST);
    }

    // So sánh với các backup codes đã hash
    const isValid = await TwoFAService.verifyBackupCode(token, user.twoFactorBackupCodes);
    if (!isValid) {
      return errorResponse(res, Constants.MESSAGES._TOKEN_INVALID, Constants.UNAUTHORIZED);
    }

    // Nếu verify thành công → xoá code đó khỏi DB (1 lần dùng duy nhất)
    const newBackupCodes = await TwoFAService.removeUsedBackupCode(token, user.twoFactorBackupCodes)
    await userCredentialModel.update2FACodes(id, newBackupCodes);
    if (is2FALogin){ 
      req.user = user
      return openSession(req, res, next)
    }
    return successResponse(res, "Backup code verified successfully!");
  } catch (error) {
    next(error);
  }
})
const reAuthenticate = catchAsync(async (req, res, next) => {
    try {
        // Lấy thông tin đáng tin cậy từ cookie
        const currentUserId = cookieHelper.getClientId(req);
        const ssoProviders = cookieHelper.getSSOProviders(req);
        const currentUserName = cookieHelper.getUserName(req);

        let isReAuthenticated = false;

        if (ssoProviders && ssoProviders.length > 0) {
            const { idToken, provider } = req.body;
            if (!idToken || !provider) {
                return errorResponse(res, "SSO provider and idToken are required", Constants.BAD_REQUEST);
            }

            const ssoAccountsInDB = await userCredentialModel.findSSOUserById(currentUserId);
            const ssoProfile = provider === 'google'
                ? await authService.googleSSOLogin(idToken)
                : await authService.facebookSSOLogin(idToken);

            for (const ssoAccount of ssoAccountsInDB) {
                if (ssoAccount.provider === provider && ssoAccount.providerId === ssoProfile.sub) {
                    isReAuthenticated = true;
                    break;
                }
            }

        } else {
            const { password } = req.body;
            if (!password) {
                return errorResponse(res, "Password is required", Constants.BAD_REQUEST);
            }

            // Lấy user bằng userName từ cookie 
            const currentUser = await userCredentialModel.findAccountWithUserName(currentUserName);
            if (currentUser && await comparePassword(password, currentUser.passwordHash)) {
                isReAuthenticated = true;
            }
        }

        // --- Xử lý kết quả ---
        if (isReAuthenticated) {
            return successResponse(res, { message: "Re-authentication successful." });
        } else {
            return errorResponse(res, "Re-authentication failed. Invalid credentials.", Constants.UNAUTHORIZED);
        }

    } catch (error) {
        next(error);
    }
});
const twoFactorBackupCodeRegenerate = catchAsync ( async ( req, res, next) =>{
  try {
    const id = cookieHelper.getClientId(req);
    const user = await userCredentialModel.findUserById(id);

    if (!user || !user.twoFactorEnabled) {
      return errorResponse(res, "2FA is not enabled for this account", Constants.BAD_REQUEST);
    }

    // Generate mới
    const backupCodes = TwoFAService.generateBackupCodes();
    const hashedCodes = await TwoFAService.hashBackupCodes(backupCodes);

    // Update DB
    await userCredentialModel.update2FACodes(id, hashedCodes);

    return successResponse(
      res,
      {
        backupCodes,
        note: "Please save these backup codes securely. Old codes have been revoked."
      },
      "Backup codes regenerated successfully!"
    );
  } catch (error) {
    next(error);
  }    
})

/**
 * Debug endpoint to check cookies and session status
 */
const debugCookies = catchAsync(async (req, res) => {
  console.log('🐛 Debug cookies endpoint called');
  
  const debugInfo = {
    cookies: {
      all: req.cookies,
      refreshToken: req.cookies.refreshToken ? 'EXISTS' : 'MISSING',
      clientInformation: req.cookies.clientInformation ? 'EXISTS' : 'MISSING',
    },
    headers: {
      cookie: req.headers.cookie ? 'EXISTS' : 'MISSING',
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: req.headers['user-agent']?.slice(0, 50)
    },
    redis: {},
    recommendations: []
  };
  
  // Check Redis if we have user ID
  if (req.cookies.clientInformation) {
    try {
      const clientInfo = JSON.parse(req.cookies.clientInformation);
      const redisKey = `refresh:${clientInfo.id}`;
      const redisToken = await redis.get(redisKey);
      debugInfo.redis.key = redisKey;
      debugInfo.redis.exists = redisToken ? true : false;
    } catch (error) {
      debugInfo.redis.error = error.message;
    }
  }
  
  // Add recommendations
  if (!req.cookies.refreshToken) {
    debugInfo.recommendations.push('No refresh token cookie found. User needs to login.');
  }
  
  if (!req.headers.cookie) {
    debugInfo.recommendations.push('No Cookie header in request. Check if frontend is sending credentials: "include"');
  }
  
  if (req.cookies.refreshToken && req.cookies.clientInformation && !debugInfo.redis.exists) {
    debugInfo.recommendations.push('Cookies exist but no Redis session. Session may have expired.');
  }
  
  return successResponse(res, debugInfo, 'Cookie debug information');
})
module.exports = {
  register,
  twoFactorBackupCodeRegenerate,
  twoFactorBackupCodeVerify,
  login,
  twoFactorVerify,
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
  reAuthenticate,
  googleOAuthRedirect,
  googleOAuthCallback,
  debugCookies
};
