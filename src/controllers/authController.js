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
const { rateLimiterAuth, rateLimiterGeneral } = require('../config/limiter');
/**
* Verify Email Sent
*/
const verifyMail = catchAsync(async (req, res, next) => {
  const { jwt } = req.body
  try {
    if (!cookieHelper.getServiceGmail(req)) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
    const user = verifyToken(jwt, 'validate')
    await userCredentialModel.updateVerifiedByEmail(user.email)
    await redis.del(`register:${user.email}`)
    httpOnlyRevoke(res, "registerEmail")
    return successResponse(res, "Successful", 200)
  } catch (error) {
    next(error)
}
})
/**
* Register new user
*/
const register = catchAsync(async (req, res, next) => {
  try {
    const userInformation = req.body; // Trong này sẽ có: phoneNumber, userName, passwordHash
    const emailCookie = req.cookies.registerEmail
    // Check if user already exists
    const existingUser = await userCredentialModel.findUserByEmail(emailCookie)
    if (existingUser && existingUser.emailVerifiedAt) {
      return errorResponse(res, 'Tài khoản đã tồn tại', Constants.CONFLICT);
    }

    // Check if hacker try to jump step
    if (!emailCookie) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
      
    // Check username exists?
    const checker = await userCredentialModel.findAccountWithUserName(userInformation.userName)
    if (checker) return errorResponse(res, 'Tên người dùng đã tồn tại', Constants.BAD_REQUEST)
      
    // Hash password
    const hashedPassword = await hashPassword(userInformation.password);
    const newUser = {
      email: emailCookie,
      passwordHash: hashedPassword.valueOf(),
      phoneNumber: userInformation.phoneNumber,
      userName: userInformation.userName
    }
    await userCredentialModel.registerNewUser(newUser)

    const validateToken = generateToken({email: emailCookie}, 'validate')
    await redis.set(`register:${emailCookie}`, validateToken, 'EX', Constants.TIME_PICKER._120secs)

    // Send email to verify
    sendEmailToVerify(EmailType.REGISTER, config.URL_MAIL_PUBLIC, validateToken, emailCookie, '🚀 Link xác thực tài khoản đăng ký đã tới!', HtmlConverter.Forgot)
    return successResponse(res, 'Đã đăng ký tài khoản thành công! Hãy vào email để xác thực tài khoản của bạn', 200);
  } catch (error) {
    next(error)
  }
});
/**
* 
*/
const checkEmailExists = catchAsync ( async ( req, res ) =>{
  const { email } = req.body
  try {
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
const { userName, password } = req.body;
try {
// Find user with password
const user = await userCredentialModel.findAccountWithUserName(userName)
// Tài khoản sso sẽ có một userName vậy nên nếu không tồn tại mật khẩu => không cho đăng nhập
if (!user || !user.emailVerifiedAt || !user.passwordHash) {
  return errorResponse(res, 'Tài khoản hoặc mật không hợp lệ', Constants.BAD_REQUEST);
}
// Verify password
const isPasswordValid = await comparePassword(password, user.passwordHash);
if (!isPasswordValid) {
  return errorResponse(res, 'Mật khẩu của bạn không chính xác', Constants.BAD_REQUEST);
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
const cookieUserInformation = JSON.parse(req.cookies.clientInformation)

// Check khả nghi
if (!cookieRefreshToken) {
throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
}
try {
// Check trong Redis xem có còn hạn hay không
const key = await redis.get(`refresh:${cookieUserInformation.id}`)
const checker = await comparePassword(cookieRefreshToken, key)
if (!checker) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
  
// Sinh token mới nếu thỏa mãn điều kiện
const tokens = generateTokenPair(
  {
    id: cookieUserInformation.id, 
    email: cookieUserInformation.email, 
    userName: cookieUserInformation.userName, 
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
      userName: cookieUserInformation.userName, 
      role: cookieUserInformation.role
    }), 7*24*60*60*1000)
    
    return successResponse(res, {
      accessToken: tokens.accessToken,
    }, 'Token refreshed successfully');
  } catch (err) {
    console.error('Refresh token error: ', err.message);
    next(err)
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
    const token = generateToken({email}, 'validate')
    await redis.set(`forgot:${email}`, token, 'EX', Constants.TIME_PICKER._120secs)
    httpOnlyResponse(res, "forgotEmail", email, Constants.TIME_PICKER._1hour_ms)
    // Send email
    await sendEmailToVerify(EmailType.FORGOT, config.URL_MAIL_PUBLIC, token, email, '🚀 Link xác nhận quên mật khẩu đã tới!', HtmlConverter.Forgot)
    return successResponse(res, 'Đã xác nhận yêu cầu thay đổi mật khẩu mới thành công! Vui lòng xác nhận yêu cầu trong email của bạn!', 200)
  } catch (error) {
    next(error)
  }
})
/**
* Logout user
*/
const logout = catchAsync(async (req, res, next) => {
  try {
    const id = cookieHelper.getClientId(req)
    // Xóa cookie session ở client
    rateLimiterAuth.delete(req.ip)
    rateLimiterGeneral.delete(req.ip)
    await redis.del(`refresh:${id}`)
    httpOnlyRevoke(res, "refreshToken")
    httpOnlyRevoke(res, "clientInformation")
    return successResponse(res, null, 'Logout successful');
  } catch (error) {
    next(error)
  }
});

/**
* Get current user profile
*/
const getProfile = catchAsync(async (req, res, next) => {
  try {
    const clientId = cookieHelper.getClientId(req)
    const user = await userCredentialModel.findUserById(clientId)
    const response = userCredentialModel.getProfile(user, user.role)
    console.log(user);
    return successResponse(
      res, 
      response, 
      'Profile retrieved successfully'
    );
  } catch (error) {
    next(error)
  }
});

/**
* Update user profile
*/
const updateProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, avatar } = req.body;
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName,
        lastName,
        avatar
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
  } catch (error) {
    next(error);
  }
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

const resendVerifyEmail = catchAsync(async (req, res) =>{
  // GET FIELDS
  try {
    const { type } = req.params
    const { jwt } = req.body
    const email = cookieHelper.getServiceGmail(req)
    if (!EmailTypeList.includes(type)) return errorResponse(res, 'Invalid type params', Constants.BAD_REQUEST)
      
    // SET CONTENT TO SEND MAIL
    const subject = type == EmailType.FORGOT? '🚀 Link xác nhận quên mật khẩu đã tới!': '🚀 Link xác thực tài khoản đăng ký đã tới!'
    const htmlContent = type == EmailType.FORGOT? HtmlConverter.Forgot: HtmlConverter.Register
    
    const { iat, exp, ...decodedInformation } = verifyToken(jwt, "validate")
    const newToken = generateToken( decodedInformation, 'validate')
    await redis.set(`${type}:${email}`, newToken, 'EX', Constants.TIME_PICKER._120secs)
    
    // Send Email
    await sendEmailToVerify(type, config.URL_MAIL_PUBLIC, newToken, email, subject, htmlContent)
    return successResponse(res, 'Đã nhận được yêu cầu của bạn, vui lòng xác nhận trong email!', 200)
  } catch (error) {
    next(error)
  }
  //... Để dành nếu còn nữa
  
})
const resetPassword = catchAsync( async (req, res, next) => {
  try {
    const { jwt, newPassword } = req.body
    const { email } = verifyToken(jwt, 'validate')
    await redis.del(`forgot:${email}`)
    const hashedNewPassword = await hashPassword(newPassword);
    await userCredentialModel.updatePassword(email, hashedNewPassword.valueOf())
    httpOnlyRevoke(res, "forgotEmail")
    return successResponse(res, 'Successful', 200)
  } catch (error) {
    next(error)
  }
})
const openSession = catchAsync ( async (req, res, next) => {
  try {
    const user = req.user
    console.log(user)
    if (!user) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
      const ssoUsers = await userCredentialModel.findSSOUserById(user.id);
    const ssoProviders = (ssoUsers || []).map(s => s.provider);
    
    const clientPayload = {
      id: user.id,
      email: user.email,
      userName: user.userName,
      role: user.role,
      ssoProviders
    };
    
    const tokens = generateTokenPair(clientPayload);
    
    // Hash refresh token lưu vào Redis
    const hashed = await hashPassword(tokens.refreshToken);
    await redis.set(`refresh:${user.id}`, hashed, 'EX', Constants.TIME_PICKER._7day_secs);
    
    // Gửi cookie xuống client
    httpOnlyResponse(res, 'refreshToken', tokens.refreshToken, Constants.TIME_PICKER._7day_ms);
    httpOnlyResponse(res, 'clientInformation', JSON.stringify(clientPayload), Constants.TIME_PICKER._7day_ms);
    
    return successResponse(res, { accessToken: tokens.accessToken }, 'Login successful');
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

const loginSSO = catchAsync( async (req, res, next) => {
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
    let userName = convertToAscii(user.userName)
    let ssoUser = await userCredentialModel.findUserBySSO(provider, user.sub)
    
    // If user hasn't been created
    if (!ssoUser) {
      const newUserName = await authService.generateUniqueUserName(userName)
      const email = provider === 'google'? user.email : undefined
      if (email && await userCredentialModel.findUserByEmail(email)) 
        return errorResponse(res, 'User with this email already in use', 409)
      
      ssoUser = await userCredentialModel.createSSOAccount(provider, user.sub, {
        userName: newUserName,
        email
      })
    }
    // Nếu 2FA có bật, tạo token mới để xác nhận việc xác nhận 2FA
    if (ssoUser.twoFactorEnabled) {
      const payload = {
        id: ssoUser.id,
        role: ssoUser.role
      }
      const mfaToken = generateToken(payload, '2fa')
      return successResponse(res, { "2FA Token": mfaToken }, "2FA required", Constants.OK)
    }
    // Nếu không thì gán user cho người tiếp theos
    req.user = ssoUser
    // Declare user for the open Session 
    // Open account session twoFactorEnabled
    return openSession(req, res, next)
  } catch (error) {
    next(error)
  }
})
const checkSession = catchAsync ( async ( req, res ) => {
  // Get fields
  const token = cookieHelper.getRefreshToken(req)
  const id = cookieHelper.getClientId(req)
  const refreshHash = await redis.get(`refresh:${id}`)
  // Check fields
  if (!refreshHash) return errorResponse(res, "Session not available", Constants.BAD_REQUEST)
    const checker = await comparePassword(token, refreshHash)
  // Return
  if (checker) return successResponse(res)
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
  reAuthenticate
};
