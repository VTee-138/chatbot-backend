const userCredentialModel = require("../model/userCredentialModel")
const { Constants, ErrorResponse } = require("../utils/constant")
const { hashPassword, generateApiKey } = require("../utils/crypto")
const ssoService = require("../utils/ssoService")

class authService{
    async googleSSOLogin(accessToken){
        try {
            const payload = await ssoService.verifyGoogleToken(accessToken)
            if (!payload || !payload.email_verified) {
                throw new Constants.ErrorResponse("GOOGLE ERROR: Invalid Id Token", constant.BAD_REQUEST)
            }
            return { sub: payload.sub, userName: payload.name, email: payload.email}
        } catch (error) {
            console.error(error)
            throw error
        }
    }
    async facebookSSOLogin(accessToken){ 
        try {
            const payload = await ssoService.verifyFacebookToken(accessToken)
            console.log(payload.id)
            return { sub: payload.id, userName: `${payload.first_name} ${payload.last_name}`}
        } catch (error) {
            throw error
        }
    }
    validateForgotAccount = async (email) => {
        const user = await userCredentialModel.findUserByEmail(email)
        if (!user) {
            const error = new ErrorResponse("Tài khoản không tồn tại")
            error.status = Constants.BAD_REQUEST
            throw error
        }

        if (!user.emailVerifiedAt) {
            const error = new ErrorResponse("Email chưa được xác minh")
            error.status = Constants.BAD_REQUEST
            throw error
        }

        const isSSO = await userCredentialModel.isSSOAccount(user.id)
        if (isSSO) {
            const error = new ErrorResponse("Tài khoản SSO không thể dùng chức năng quên mật khẩu")
            error.status = Constants.BAD_REQUEST
            throw error
        }
        return user
    }
    // maxAttempts trong trường hợp kẹt vòng lặp
    async generateUniqueUserName(baseName, length = 2, maxAttempts = 10){
        let attempts = 0;
        let newUserName;
        while (attempts < maxAttempts) {
            attempts++;

            newUserName = baseName + generateApiKey(length);

            const isUserNameExists = await userCredentialModel.findAccountWithUserName(newUserName);
            if (!isUserNameExists) return newUserName; 
            
        }
        throw new Error("Không thể tạo username duy nhất sau nhiều lần thử");
    }

}

module.exports = new authService