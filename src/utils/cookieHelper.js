const { Constants, ErrorResponse } = require("./constant")
const process = require('../config');
class CookieHelper {
    parseClientInfo(req) {
        try {
            return JSON.parse(req.cookies.clientInformation || "{}")
        } catch (err) {
            throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        }
    }
    getClientInformation(req) {
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo
    }
    getClientId(req) {
        if(process.NODE_ENV == 'development') {
            return req.user.id;
        }
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo.id) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo.id
    }

    getUserName(req) {
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo.userName) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo.userName
    }

    getSSOProviders(req) {
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo.ssoProviders) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo.ssoProviders
    }

    getUserMail(req) {
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo.email) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo.email
    }

    getRefreshToken(req) {
        const token = req.cookies.refreshToken
        if (!token) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return token
    }

    getServiceGmail(req) {
        const email = req.cookies.registerEmail ?? req.cookies.forgotEmail
        if (!email) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return email
    }
}

module.exports = new CookieHelper()
