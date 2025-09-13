const userCredentialModel = require("../model/userCredentialModel")
const { Constants } = require("../utils/constant")
const ssoService = require("../utils/ssoService")

class authService{
    async googleSSOLogin(accessToken){
        try {
            const payload = await ssoService.verifyGoogleToken(accessToken)
            if (!payload || !payload.email_verified) {
                throw new constant.ErrorResponse("GOOGLE ERROR: Invalid Id Token", constant.BAD_REQUEST)
            }
            return payload
        } catch (error) {
            throw error
        }
    }
    async facebookSSOLogin(accessToken){ 
        try {
            const payload = await ssoService.verifyFacebookToken(accessToken)
            return { sub: payload.id, fullName: `${payload.first_name} ${payload.last_name}`}
        } catch (error) {
            throw error
        }
    }
    validateForgotAccount = async (email) => {
        const user = await userCredentialModel.findUserByEmail(email)
        if (!user) {
            const error = new Error("Tài khoản không tồn tại")
            error.status = Constants.BAD_REQUEST
            throw error
        }

        if (!user.emailVerifiedAt) {
            const error = new Error("Email chưa được xác minh")
            error.status = Constants.BAD_REQUEST
            throw error
        }

        const isSSO = await userCredentialModel.isSSOAccount(user.id)
        if (isSSO) {
            const error = new Error("Tài khoản SSO không thể dùng chức năng quên mật khẩu")
            error.status = Constants.BAD_REQUEST
            throw error
        }
        return user
    }

}

module.exports = new authService