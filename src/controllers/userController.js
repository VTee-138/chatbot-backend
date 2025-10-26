const qrcode = require("qrcode")
const redis = require("../config/redis")
const userCredentialModel = require("../model/userCredentialModel")
const { get2FAStatus } = require("../model/userCredentialModel")
const TwoFAService = require("../services/2FAService")
const { Constants } = require("../utils/constant")
const cookieHelper = require("../utils/cookieHelper")
const { errorResponse, catchAsync, successResponse } = require("../utils/response")
const UserService = require("../services/userService")

class userController {
    twoFactorGenerate = catchAsync(async (req, res) => {
        // Kiểm tra xem người dùng đã enable 2FA chưa -> có -> mới được chạy 
        const userName = cookieHelper.getUserName(req)
        const email = cookieHelper.getUserMail(req)
        console.log(userName)
        if (await userCredentialModel.get2FAStatus(userName)) return errorResponse(res, "2FA Available!", Constants.BAD_REQUEST)
        const providers = cookieHelper.getSSOProviders(req) || []

        // Setup for check
        const secret = TwoFAService.generateSecret()
        await redis.set(`2fa:${userName}`, secret, 'EX', Constants.TIME_PICKER._1day)
        // Create uri => QR
        const identity = providers.includes("google") ? email : userName;
        const uri = TwoFAService.generateOTPURI(identity)
        const qrOTPURI = await qrcode.toDataURL(uri)
        return successResponse(res, { qr: qrOTPURI }, "Successful")
    })
    twoFactorEnable = catchAsync(async (req, res, next) => {
        // get information
        const { token } = req.body
        console.log(token)
        const userName = cookieHelper.getUserName(req)
        // check error
        if (!token) return errorResponse(res, "Your code not available", Constants.BAD_REQUEST)
        // Get secret and check
        const secret = await redis.get(`2fa:${userName}`)
        const checker = TwoFAService.verifyOTP(token, secret)
        if (!checker) return errorResponse(res, "Token Invalid", Constants.UNAUTHORIZED)
        // Generate codes + hash codes 
        const backupCodes = TwoFAService.generateBackupCodes()
        const hashBackupCodes = await TwoFAService.hashBackupCodes(backupCodes)
        // Remove trash
        await redis.del(`2fa:${userName}`)
        // Store Database 
        await userCredentialModel.enable2FAMode(userName, secret, hashBackupCodes)
        return successResponse(res, { backupCodes }, "2FA enabled successfully!")
    })
    twoFactorDisable = catchAsync(async (req, res, next) => {

        const { token } = req.body
        const id = cookieHelper.getClientId(req)
        const userName = cookieHelper.getUserName(req)
        const user = await userCredentialModel.findUserById(id)
        if (!user.twoFactorEnabled) return errorResponse(res, 'MFA is disabled')
        const checker = TwoFAService.verifyOTP(token, user.secret)
        if (!checker) return errorResponse(res, Constants.MESSAGES._TOKEN_INVALID, Constants.BAD_REQUEST)
        await userCredentialModel.disable2FAMode(userName)
        return successResponse(res, "2FA disabled successfully")
    })
    async search(req, res, next) {
        try {
            const { keyword, page } = req.query;
            const result = await UserService.searchUsers({
                keyword,
                page: Number(page) || 1,
            });

            return res.json(result);
        } catch (error) {
            next(error);
        }
    }

}

module.exports = new userController