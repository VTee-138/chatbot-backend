const { Router } = require("express");
const { authenticate, authLimiter } = require("../middleware/auth");
const { redisValidate } = require("../middleware/validate");
const { JSONCookies, JSONCookie } = require("cookie-parser");
const userController = require("../controllers/userController");
const cookieHelper = require("../utils/cookieHelper");
const TwoFAService = require("../services/2FAService");
const { successResponse } = require("../utils/response");

const userRouter = Router()
// userRouter.get('/profile')
// userRouter.put('/profile/update')

// Store lại trong Redis, chưa lưu trong db, và gửi mail để xác nhận đã đăng nhập 
// authenticator, nếu không có thể xóa ( cái này chỉ hoạt động khi )
userRouter.post('/2fa/generate', authLimiter, authenticate, redisValidate('2fa', cookieHelper.getUserName.bind(cookieHelper)), userController.twoFactorGenerate)
// Sau khi hoàn thành toàn bộ quy trình sẽ enable chức năng này, verfiy email 
userRouter.post('/2fa/enable', authLimiter, authenticate, userController.twoFactorEnable)
userRouter.post('/2fa/disable', authLimiter, authenticate, userController.twoFactorDisable)
// userRouter.post('/2fa', (req, res) => { return successResponse(res, {otp: TwoFAService.generateOTP('EMDWIZZ4DIWTI7C2')})}) 
module.exports = userRouter