const { hashPassword, comparePassword, generateApiKey, createShield } = require('../utils/crypto');
const { generateTokenPair, generateToken, decodePayload } = require('../utils/jwt');
const { successResponse, errorResponse, catchAsync } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');
const { Role } = require('../../generated/prisma');
const { sendEmailToVerify } = require('../utils/mailService');
const { EmailType, HtmlConverter, EmailTypeList } = require('../utils/mailConverter');
const verifyMailService  = require('../utils/verifyMailService')
const {verifyGoogleIdToken} = require('../utils/googleService')
const UserDBService = require('../utils/UserDBService')
const { facebookVerifyLogin } = require('../utils/facebookService');
const { ResetForgotPasswordSchema } = require('../utils/schema');
const { sessionLoginRotation } = require('../utils/sessionUtils');

/**
 * Verify Email Sent
 */
const verifyMail = catchAsync(async (req, res) => {
  const { type } = req.params
  const { jwt } = req.body
  if (EmailTypeList.includes(type))
  {
    try {
        if (type === 'forgot'){
          const user = await verifyMailService.verifyForgotMail(jwt)
          // Đi tới trang reset password
          return res.redirect('/reset-password')
        }
        else if (type=='register'){
          const user =  await verifyMailService.verifyRegisterMail(jwt)
          await UserDBService.registerNewUser(user)
        }
        return successResponse(res, "Successful", 200)
    } catch (error) {
        return errorResponse(res, error.message ,400)
    }
  }
  else return errorResponse(res, 'Invalid API Type', 400)
})
/**
 * Register new user
 */
const register = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });
  
  if (existingUser) {
    return errorResponse(res, 'User with this email already exists', 409);
  }
  // Hash password
  const hashedPassword = await hashPassword(password);
  await redis.set(`hash:${email}`, hashedPassword.valueOf(), 'EX', 60*60*30) // Mật khẩu sẽ tự động được dọn trong vòng 1h30, để sạch database 
  const shield = createShield(16)
  console.log('REGISTER SHIELD: ', shield)
  await redis.set(`shield:${email}`, shield, 'EX', 40)
  const validateToken = generateToken({email: email, shield: shield}, 'validate')
  await sendEmailToVerify(EmailType.REGISTER, "chatbot-frontend.aipencil.name.vn", validateToken, email, '🚀 Link xác thực tài khoản đăng ký đã tới!', HtmlConverter.Forgot)
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
  const user = await UserDBService.findUserByEmail(email)
  if (!user) {
    return errorResponse(res, 'Invalid email or password', 401);
  }
  // Verify password
  const isPasswordValid = await comparePassword(password, user.hashPassword);
  if (!isPasswordValid) {
    return errorResponse(res, 'Invalid email or password', 401);
  }
  // Update last login
  await UserDBService.updateUserLastLogin(user.id)
  // Payload neccessary needed to send over to client
  // Generate tokens
  const clientPayload = { 
    id: user.id,
    email: user.email,
    firstName: user.firstName, 
    lastName: user.lastName,
    role: user.role
   }
   console.log("DB NORMAL ACCOUNT: ", clientPayload)
  const tokens = generateTokenPair(clientPayload);
  const sessionData = {
    user: clientPayload,
    refreshToken: tokens.refreshToken
  }
  await sessionLoginRotation(req, sessionData)
  console.log(req.session.id)
  return successResponse(res, {
    user: clientPayload,
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
  const refreshTokenFromSession = req.session?.refreshToken
  console.log(req.session.id)
  console.log(req.session.refreshToken)
  if (!refreshTokenFromSession) {
    return errorResponse(res, 'Refresh token not found', 401);
  }

  try {
    const { verifyToken } = require('../utils/jwt');
    const payload = verifyToken(refreshTokenFromSession, 'refresh'); // verify refresh token
    console.log(payload)
    const userChecker = await redis.get(`sess:${req.session.id}`) // khi trả về, redis trả về dạng chuỗi không phải JSON
    const sessionData = JSON.parse(userChecker)
    console.log(sessionData.user.id)
    // So sánh với userId trong session (nếu bạn lưu thêm userId)
    if (payload.id !== sessionData.user.id) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }
    // Sinh token mới
    // Nếu truyền vào là userChecker => lỗi Refresh token error:  invalid expiresIn option for string payload
    // Vì nó không phải là một object
    const tokens = generateTokenPair(sessionData); 

    // Cập nhật refresh token mới vào session
    req.session.refreshToken = tokens.refreshToken;

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
  const email = req.email
  try {
    const shield = createShield(16)
    await redis.set(`shield:${email}`, shield, 'EX',40)
    const token = generateToken({email, shield}, 'validate')
    await sendEmailToVerify(EmailType.FORGOT, 'chatbot-fe.aipencil.name.vn',token, email, '🚀 Link xác nhận quên mật khẩu đã tới!', HtmlConverter.Forgot)
    return successResponse(res, 'Đã xác nhận yêu cầu thay đổi mật khẩu mới thành công! Vui lòng xác nhận yêu cầu trong email của bạn!', 200)
  } catch (error) {
    return errorResponse(res, 'Lỗi Server', 500)
  }
})
/**
 * Logout user
 */
const logout = catchAsync(async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Find and deactivate session
    req.session.destroy((err) => {
    if (err) {
      console.error("Lỗi khi xóa session:", err)
      return res.status(500).json({ message: "Không thể xóa session" })
    }
    // Xóa cookie session ở client
    res.clearCookie("connect.sid") 
    return res.json({ message: "Đã đăng xuất thành công" })
  })
  }
  else return errorResponse(res, 'Lỗi Request Authorization', 400)
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
  await UserDBService.updatePasswordByID(req.user.id, hashedNewPassword)
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
  await UserDBService.updatePassword(email, newPassword)
  return successResponse(res, 'Successful', 200)
})
// GOOGLE SSO LOGIN
const googleSSOLogin = async (req, res ) =>{
  const { idToken } = req.body
        if (!idToken) return errorResponse(res, "INVALID PARAMS REQUEST", 400)
    try {
        const { email, name, sub, given_name, family_name} = await verifyGoogleIdToken(idToken)
        const userInput = { email, name, given_name, family_name }
        const {password, createdAt, lastLogin, updatedAt, avatar, ...ssoUser} = await UserDBService.ssoLoginChecker('google', sub, userInput)
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
    const { password, createdAt, lastLogin,updatedAt, avatar, ...ssoUser} = await UserDBService.ssoLoginChecker('facebook', payload.id, payload)
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