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
    fullName: userInformation.userName ?? null,
    email: userInformation.email,
    passwordHash: hashedPassword.valueOf(),
    phoneNumber: userInformation.phoneNumber ?? null
  }
  await userCredentialModel.registerNewUser(newUser)
  const validateToken = generateToken({email: userInformation.email, fullName: userInformation.userName}, 'validate')
  await redis.set(`register:${email}`, validateToken, 'EX', 60*60)
  await sendEmailToVerify(EmailType.REGISTER, process.env.MAIL_PUBLIC, validateToken, email, '🚀 Link xác thực tài khoản đăng ký đã tới!', HtmlConverter.Forgot)
  // // Create user
  // const user = await prisma.user.create({
  //   data: {
  //     email: email,
  //     password: hashedPassword.valueOf(),
  //   },
  //   select: {
  //     id: true,
  //     email: true,
  //     firstName: true,
  //     lastName: true,
  //     role: true,
  //     createdAt: true,
  //   },
  // });
  
  // Generate tokens
  // const tokens = generateToken(user);
  
  // // Create session
  // await prisma.session.create({
  //   data: {
  //     sessionToken: tokens.accessToken,
  //     refreshToken: tokens.refreshToken,
  //     userId: user.id,
  //     userAgent: req.headers['user-agent'],
  //     ipAddress: req.ip,
  //     expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  //   },
  // });
  
  return successResponse(res, 'Đã đăng ký tài khoản thành công! Hãy vào email để xác thực tài khoản của bạn', 200);
});

/**
 * Login user
 * Có 2 case mà client sẽ phải gọi đến api này
 * - Người mới tạo tài khoản xong, chưa đăng nhập, chưa tồn tại bất cứ session Id nào trong db
 * - Người dùng đã log out => mất session db, nên phải login lại từ đầu
 */
const login = catchAsync(async (req, res) => {
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
  // Payload neccessary needed to send over to client
  // Generate tokens
  const clientPayload = { 
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role
   }
  const tokens = generateTokenPair(clientPayload);
  httpOnlyResponse(res, "refreshToken", tokens.refreshToken, 7*24*60*60*1000)
  httpOnlyResponse(res, "clientInformation", JSON.stringify(clientPayload), 7*24*60*60*1000)
  
  return successResponse(res, {
    accessToken: tokens.accessToken,
  }, 'Login successfully!');
});
/**
 * Refresh access token, xác thực refresh token thông qua req.session, vì đã lưu
 * thông tin của nó trong session khi tạo tài khoản ban đầu
 * Khi người dùng thoát khỏi browser mà vào lại, thì client sẽ gọi đến đây
 * Request đến đây sẽ check client request httpOnly Cookie, xem liệu người dùng này có tồn tại trong session hay không
 * Có 2 case mà người dùng sẽ gọi đến controller này:
 * +, Hết hạn access token được lưu trong memory client, nhưng vẫn còn hạn refresh token 
 * +, Persistent logging khi người dùng đăng nhập mà thoát browser, khi quay lại dù access_token hết hạn nhưng vẫn tồn tại session => pass
 */
const refreshToken = catchAsync(async (req, res) => {
  // Sẽ setup thêm cả access token để check
  const cookieRefreshToken = req.cookies.refreshToken
  const cookieUserInformation = JSON.parse(req.cookies.clientInformation)
  if (!cookieRefreshToken) {
    // revoke key ngay khi thấy dấu hiệu
    httpOnlyRevoke(res, "refreshToken")
    return errorResponse(res, 'Refresh token not valid', 403);
  }
T
  try {
    const key = await redis.get(`refresh:${cookieUserInformation.id}`)
    const checker = await comparePassword(cookieRefreshToken, key)

    if (!checker) {
      httpOnlyRevoke(res, "refreshToken")
      return errorResponse(res, 'Invalid refresh token', 401);
    }
    // Sinh token mới
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
    const result = await userCredentialModel.findUserByEmail(email)
    if (!result) return errorResponse(res, "Tài khoản này không hợp lệ hoặc chưa được tạo", Constants.OK) 
    const shield = createShield(14)
    await redis.set(`shield:${email}`, shield, 'EX', 30*60)
    const token = generateToken({email, shield}, 'validate')
    await sendEmailToVerify(EmailType.FORGOT, process.env.MAIL_PUBLIC, token, email, '🚀 Link xác nhận quên mật khẩu đã tới!', HtmlConverter.Forgot)
    return successResponse(res, 'Đã xác nhận yêu cầu thay đổi mật khẩu mới thành công! Vui lòng xác nhận yêu cầu trong email của bạn!', 200)
  } catch (error) {
    return errorResponse(res, 'Lỗi Server', 500)
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
  // // Deactivate all sessions except current one
  // const authHeader = req.headers.authorization;
  // const currentToken = authHeader ? authHeader.substring(7) : null;
  return successResponse(res, null, 'Password changed successfully');
});
const resendVerifyEmail = catchAsync(async (req, res) =>{
  const {type} = req.params
  if (!EmailTypeList.includes(type)) return errorResponse(res, 'Invalid type params', 400)
  const { jwt } = req.body
  const subject = type == EmailType.FORGOT? '🚀 Link xác nhận quên mật khẩu đã tới!': '🚀 Link xác thực tài khoản đăng ký đã tới!'
  const htmlContent = type == EmailType.FORGOT? HtmlConverter.Forgot: HtmlConverter.Register
  /// HẠN CHẾ TRONG FORGOT VÀ REGISTER, NẾU CÓ CÓ THỂ MỞ RỘNG
  const { email } = decodePayload(jwt)
  // Handle DDos Mail Requests
  const shieldChecker = await redis.get(`shield:${email}`)
  if (shieldChecker) return errorResponse(res, "Too Many Requests", 429)
  const newShieldId =  createShield(16)
  await redis.del(`shield:${email}`)
  await redis.set(`shield:${email}`, newShieldId,'EX',40)
  console.log('NEW SHIELD: ', newShieldId)
  const newToken = generateToken( {email,shield: newShieldId},'validate')
  // Send Email
  await sendEmailToVerify(type, "chatbot-fe.aipencil.name.vn", newToken, email, subject, htmlContent)
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
const loginSSO = catchAsync( async (req, res) => {
  
})
// GOOGLE SSO LOGIN
const googleSSOLogin = async (req, res ) =>{
  const { idToken } = req.body
        if (!idToken) return errorResponse(res, "INVALID PARAMS REQUEST", 400)
    try {
        const { email, name, sub, given_name, family_name} = await verifyGoogleIdToken(idToken)
        const userInput = { email, name, given_name, family_name }
        const {password, createdAt, lastLogin, updatedAt, avatar, ...ssoUser} = await userCredentialModel.ssoLoginChecker('google', sub, userInput)
        console.log("SSO FROM DB: ", ssoUser)
        const tokens = generateTokenPair(ssoUser) 
        const sessionData = {
          user: ssoUser,
          refreshToken: tokens.refreshToken
        }
        await sessionLoginRotation(req, sessionData)
        return successResponse(res, {
          user: ssoUser,
          accessToken: tokens.accessToken,
        }, 'Login successfully!');
    } catch (error) {
        console.error("Error Google Login: ", error.message)
        return errorResponse(res, 'Lỗi Server', 500)
    }
}
// Facebook SSO LOGIN
const facebookSSOLogin = async (req, res) =>{
  const { accessToken } = req.body
  if (!accessToken) return errorResponse(res, 'Facebook access token is required.',400)
  try {
    const payload = await facebookVerifyLogin(accessToken)
    const { password, createdAt, lastLogin,updatedAt, avatar, ...ssoUser} = await userCredentialModel.ssoLoginChecker('facebook', payload.id, payload)
    const tokens = generateTokenPair(ssoUser)
    console.log("SSO FROM DB: ", ssoUser)
    const sessionData = {
      user: ssoUser,
      refreshToken: tokens.refreshToken
    }
    await sessionLoginRotation(req, sessionData)
    return successResponse(res, {
          user: ssoUser,
          accessToken: tokens.accessToken,
        }, 'Login successfully!');
  } catch (error) {
    console.error("Lỗi Facebook: ", error) 
    return errorResponse(res, 'Lỗi: ' + error.message, 400)
  }
}
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
  googleSSOLogin,
  facebookSSOLogin,
  resetPassword
};


/// Case khi người dùng đăng nhập sso google trước, và tài khoản đăng ký thường sau
/// => Trùng lặp database về trường email 