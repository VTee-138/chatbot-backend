const { Constants, ErrorResponse } = require("./constant")
const config = require('../config');

/**
 * Cookie Helper - Enhanced version with better security
 */
class CookieHelper {
    parseClientInfo(req) {
        try {
            const cookieValue = req.cookies.clientInformation
            if (!cookieValue) {
                return null
            }
            const parsed = JSON.parse(cookieValue)
            // Validate that it's an object and not an empty object
            if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
                return null
            }
            return parsed
        } catch (err) {
            console.error('Failed to parse clientInformation cookie:', err.message)
            throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        }
    }

    getClientInformation(req) {
        const clientInfo = this.parseClientInfo(req)
        if (!clientInfo) throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
        return clientInfo
    }

    getClientId(req) {
        // Always use cookie - no development bypass for consistency
        // If you need req.user.id, use it directly instead of this helper
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

    /**
     * Get cookie options based on environment
     * @returns {Object} Cookie options
     */
    getCookieOptions() {
        return {
            httpOnly: true,
            secure: config.COOKIE_SECURE,
            sameSite: config.COOKIE_SAME_SITE,
            domain: config.COOKIE_DOMAIN,
            path: '/'
        };
    }

    /**
     * Set authentication cookies (access + refresh tokens)
     * @param {Response} res - Express response object
     * @param {Object} tokens - Tokens object { accessToken, refreshToken }
     */
    setAuthCookies(res, tokens) {
        const cookieOptions = this.getCookieOptions();

        // Set access token
        res.cookie('accessToken', tokens.accessToken, {
            ...cookieOptions,
            maxAge: this.parseExpiry(config.JWT_EXPIRES_IN)
        });

        // Set refresh token
        res.cookie('refreshToken', tokens.refreshToken, {
            ...cookieOptions,
            maxAge: this.parseExpiry(config.JWT_REFRESH_EXPIRES_IN)
        });

        // Set CSRF token if provided
        if (tokens.csrfToken) {
            res.cookie('XSRF-TOKEN', tokens.csrfToken, {
                ...cookieOptions,
                httpOnly: false, // CSRF token needs to be read by JS
                maxAge: this.parseExpiry(config.JWT_EXPIRES_IN)
            });
        }
    }

    /**
     * Clear authentication cookies
     * @param {Response} res - Express response object
     */
    clearAuthCookies(res) {
        const cookieOptions = this.getCookieOptions();
        
        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);
        res.clearCookie('XSRF-TOKEN', cookieOptions);
        res.clearCookie('clientInformation', cookieOptions);
    }

    /**
     * Set temporary cookie (for email verification, password reset, etc.)
     * @param {Response} res - Express response object
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {number} expiryMinutes - Expiry in minutes
     */
    setTempCookie(res, name, value, expiryMinutes = 5) {
        res.cookie(name, value, {
            ...this.getCookieOptions(),
            maxAge: expiryMinutes * 60 * 1000
        });
    }

    /**
     * Parse expiry string (e.g., '15m', '7d') to milliseconds
     * @param {string} expiry - Expiry string
     * @returns {number} Milliseconds
     */
    parseExpiry(expiry) {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) return 15 * 60 * 1000; // default 15 minutes

        const value = parseInt(match[1]);
        const unit = match[2];

        const multipliers = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        };

        return value * multipliers[unit];
    }

    /**
     * Set client information cookie
     * @param {Response} res - Express response object
     * @param {Object} clientInfo - Client information
     */
    setClientInfo(res, clientInfo) {
        res.cookie('clientInformation', JSON.stringify(clientInfo), {
            ...this.getCookieOptions(),
            maxAge: this.parseExpiry(config.JWT_EXPIRES_IN)
        });
    }
}

module.exports = new CookieHelper()
