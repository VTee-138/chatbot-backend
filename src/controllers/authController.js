const { hashPassword, comparePassword, generateApiKey, createShield } = require('../utils/crypto');
const { generateTokenPair, generateToken, decodePayload, verifyToken } = require('../utils/jwt');
const { successResponse, errorResponse, catchAsync, httpOnlyRevoke, httpOnlyResponse } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');
const { Role } = require('../../generated/prisma');
const { sendEmailToVerify } = require('../utils/mailService');
const { EmailType, HtmlConverter, EmailTypeList } = require('../utils/mailConverter');
const verifyMailService  = require('../utils/verifyMailService')
const {verifyGoogleIdToken} = require('../utils/googleService')
const userCredentialModel = require('../model/userCredentialModel')
const { facebookVerifyLogin } = require('../utils/facebookService');
const { ResetForgotPasswordSchema } = require('../utils/schema');
const { sessionLoginRotation } = require('../utils/sessionUtils');
const { Constants } = require('../utils/constant');
const authService = require('../services/authService');
const { redisValidate } = require('../utils/validate');
const config = require('../config');

/**
 * Verify Email Sent
 */
const verifyMail = catchAsync(async (req, res) => {
  const { jwt } = req.body
  try {
      const user = verifyToken(jwt, 'validate')
      await userCredentialModel.updateVerifiedByEmail(user.email)
      await redis.del(`register:${user.email}`)
      return successResponse(res, "Successful", 200)
  } catch (error) {
      if (error.name === 'TokenExpiredError') {
          return errorResponse(res, 'Token has expired', Constants.BAD_REQUEST)
      }
      if (error.name === 'JsonWebTokenError') {
          return errorResponse(res, 'Invalid token', Constants.BAD_REQUEST)
      }
      return errorResponse(res, error.message, 400)
  }
})
/**
 * Register new user
 */
const register = catchAsync(async (req, res) => {
  const userInformation = req.body;
  
  // Check if user already exists
  const existingUser = await userCredentialModel.findUserByEmail(userInformation.email)
  if (existingUser && existingUser.emailVerifiedAt) {
    return errorResponse(res, 'User with this email already exists', 409);
  }

  // Hash password
  const hashedPassword = await hashPassword(password);
  const newUser = {
    email: userInformation.email,
    passwordHash: hashedPassword.valueOf()
  }
  // Generate token
  await userCredentialModel.registerNewUser(newUser)
  const shield = createShield(14)
  const validateToken = generateToken({email, shield}, 'validate')
  await redis.set(`register:${email}`, validateToken, 'EX', 60*60)

  // Send email to verify
  sendEmailToVerify(EmailType.REGISTER, process.env.URL_MAIL_PUBLIC, validateToken, email, '🚀 Link xác thực tài khoản đăng ký đã tới!', HtmlConverter.Forgot)
  return successResponse(res, 'Đã đăng ký tài khoản thành công! Hãy vào email để xác thực tài khoản của bạn', 200);
});

/**
 * Login user
 * Có 2 case mà client sẽ phải gọi đến api này
 * - Người mới tạo tài khoản xong, chưa đăng nhập, chưa tồn tại bất cứ session Id nào trong db
 * - Người dùng đã log out => mất session db, nên phải login lại từ đầu
 */
const login = catchAsync(async (req, res) => {
  // GET FIELD
  const { email, password } = req.body;

  // Find user with password
  const user = await userCredentialModel.findUserByEmail(email)
  if (!user || !user.emailVerifiedAt) {
    return errorResponse(res, 'Tài khoản hoặc mật không hợp lệ', Constants.BAD_REQUEST);
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return errorResponse(res, 'Mật khẩu của bạn không chính xác', Constants.BAD_REQUEST);
  }

  // Generate tokens
  // Payload neccessary needed to send over to client
  const clientPayload = { 
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role
   }
  const tokens = generateTokenPair(clientPayload);
  
  // Set httpOnly cookies
  httpOnlyResponse(res, "refreshToken", tokens.refreshToken, 7*24*60*60*1000)
  httpOnlyResponse(res, "clientInformation", JSON.stringify(clientPayload), 7*24*60*60*1000)
  
  return successResponse(res, {
    accessToken: tokens.accessToken,
  }, 'Login successfully!');
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
  const cookieUserInformation = JSON.parse(req.cookies.clientInformation)

  // Check khả nghi
  if (!cookieRefreshToken) {
    // revoke key ngay khi thấy dấu hiệu
    httpOnlyRevoke(res, "refreshToken")
    return errorResponse(res, 'Refresh token not valid', 403);
  }
T
  try {
    // Check trong Redis xem có còn hạn hay không
    const key = await redis.get(`refresh:${cookieUserInformation.id}`)
    const checker = await comparePassword(cookieRefreshToken, key)
    if (!checker) {
      httpOnlyRevoke(res, "refreshToken")
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    // Sinh token mới nếu thỏa mãn điều kiện
    const tokens = generateTokenPair(
      {
        id: cookieUserInformation.id, 
        email: cookieUserInformation.email, 
        fullName: cookieUserInformation.fullName, 
        role: cookieUserInformation.role
      }); 

    // Hash lại refresh token
    const hashToken = await hashPassword(tokens.refreshToken)
    await redis.set(`refresh:${cookieUserInformation.id}`, hashToken.valueOf(), 'EX', 7*24*60*60)

    // Cập nhật refresh token mới vào cookie
    httpOnlyResponse(res, "refreshToken", tokens.refreshToken, 7*24*60*60*1000)
    httpOnlyResponse(res, 
      "clientInformation", 
      JSON.stringify({
        id: cookieUserInformation.id, 
        email: cookieUserInformation.email, 
        fullName: cookieUserInformation.fullName, 
        role: cookieUserInformation.role
      }), 7*24*60*60*1000)

    return successResponse(res, {
      accessToken: tokens.accessToken,
    }, 'Token refreshed successfully');
  } catch (err) {
    console.error('Refresh token error: ', err.message);
    return errorResponse(res, 'Invalid or expired refresh token', 401);
  }
});


/**
 * Forgot password account
 */
const forgot = catchAsync( async(req, res) =>{
  const { email } = req.body
  try {
    // Verify có phải là một tài khoản Credential chính thức không
    await authService.validateForgotAccount(email)
    // Tạo token
    const shield = createShield(14)
    const token = generateToken({email, shield}, 'validate')
    await redis.set(`forgot:${email}`, token, 'EX', 30*60)
    // Send email
    await sendEmailToVerify(EmailType.FORGOT, process.env.URL_MAIL_PUBLIC, token, email, '🚀 Link xác nhận quên mật khẩu đã tới!', HtmlConverter.Forgot)
    return successResponse(res, 'Đã xác nhận yêu cầu thay đổi mật khẩu mới thành công! Vui lòng xác nhận yêu cầu trong email của bạn!', 200)
  } catch (error) {
    console.error("Forgot password error:", error)
    return errorResponse(res, error.message || 'Lỗi Server', error.status || 500)
  }
})
/**
 * Logout user
 */
const logout = catchAsync(async (req, res) => {
  // Xóa cookie session ở client
  httpOnlyRevoke(res, "refreshToken")
  httpOnlyRevoke(res, "clientInformation")
  return successResponse(res, null, 'Logout successful');
});

/**
 * Get current user profile
 */
const getProfile = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLogin: true,
      organizations: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
  });
  
  return successResponse(res, user, 'Profile retrieved successfully');
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
  
  // Get user with password
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
  });
  
  // Verify current password
  const isCurrentPasswordValid = await comparePassword(oldPassword, user.password);
  
  if (!isCurrentPasswordValid) {
    return errorResponse(res, 'Current password is incorrect', 400);
  }
  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);
  // Update password
  await userCredentialModel.updatePasswordByID(req.user.id, hashedNewPassword)
  return successResponse(res, null, 'Password changed successfully');
});

const resendVerifyEmail = catchAsync(async (req, res) =>{
  // GET FIELDS
  const { type } = req.params
  const { jwt } = req.body
  if (!EmailTypeList.includes(type)) return errorResponse(res, 'Invalid type params', 400)

  // SET CONTENT TO SEND MAIL
  const subject = type == EmailType.FORGOT? '🚀 Link xác nhận quên mật khẩu đã tới!': '🚀 Link xác thực tài khoản đăng ký đã tới!'
  const htmlContent = type == EmailType.FORGOT? HtmlConverter.Forgot: HtmlConverter.Register
  
  const { email } = decodePayload(jwt)

  const shieldChecker = await redis.get(`shield:${email}`)
  if (shieldChecker) return errorResponse(res, "Too Many Requests", 429)
  const newShieldId =  createShield(16)
  await redis.del(`shield:${email}`)
  await redis.set(`shield:${email}`, newShieldId,'EX',40)
  const newToken = generateToken( {email,shield: newShieldId},'validate')
  // Send Email
  await sendEmailToVerify(type, config.URL_MAIL_PUBLIC, newToken, email, subject, htmlContent)
  return successResponse(res, 'Đã nhận được yêu cầu của bạn, vui lòng xác nhận trong email!', 200)
  //... Để dành nếu còn nữa
  
})
const resetPassword = catchAsync( async (req, res) => {
  const { jwt, newPassword } = req.body
  const { email } = decodePayload(jwt)
  await redis.del(`forgot:${email}`)
  await userCredentialModel.updatePassword(email, newPassword)
  return successResponse(res, 'Successful', 200)
})
const openSession = catchAsync (async (req, res) => {

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
const loginSSO = catchAsync( async (req, res) => {
  const { provider } = req.params
  const { accessToken } = req.body
  try {
    if (!accessToken) return errorResponse(res, "Yêu cầu không hợp lệ!", Constants.BAD_REQUEST)
    if (!provider || !['google', 'facebook'].includes(provider))
      return errorResponse(res, "Phương thức đăng nhập không được hỗ trợ. Vui lòng sử dụng Google hoặc Facebook", Constants.BAD_REQUEST)
    
    // Verify SSO Account
    let user = null
    if (provider == 'google') user = await authService.googleSSOLogin(accessToken)
    else user = await authService.facebookSSOLogin(accessToken)

    // Handle Verified Account
    const checker = await userCredentialModel.findSSOUser(provider, user.sub)
    if (checker && checker.emailVerifiedAt) return openSession(req, res)
    else {
    
      // store at httpOnly sub user id (biến thành session cookie)
    httpOnlyResponse(res, "sub", user.sub, undefined)
    return successResponse(res, {
      fullName: user.fullName
    }, "Thành công! Cần thêm thông tin để tạo lập tài khoản SSO")}
    
  } catch (error) {
    return errorResponse(res, "Lỗi server", Constants.INTERNAL_SERVER_ERROR)
  }
})
module.exports = {
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
  loginSSO
};


/// Case khi người dùng đăng nhập sso google trước, và tài khoản đăng ký thường sau
/// => Trùng lặp database về trường email 