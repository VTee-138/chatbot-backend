const { Constants, ErrorResponse } = require("./constant");
const config = require("../config");

/**
 * Cookie Helper - Enhanced version with better security
 */
class CookieHelper {
  parseClientInfo(req) {
    try {
      const cookieValue = req.cookies.clientInformation;
      if (!cookieValue) {
        return null;
      }
      const parsed = JSON.parse(cookieValue);
      // Validate that it's an object and not an empty object
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Object.keys(parsed).length === 0
      ) {
        return null;
      }
      return parsed;
    } catch (err) {
      console.error("Failed to parse clientInformation cookie:", err.message);
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    }
  }

  getClientInformation(req) {
    const clientInfo = this.parseClientInfo(req);
    if (!clientInfo)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return clientInfo;
  }

  getClientId(req) {
    // Always use cookie - no development bypass for consistency
    // If you need req.user.id, use it directly instead of this helper
    const clientInfo = this.parseClientInfo(req);
    if (!clientInfo.id)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return clientInfo.id;
  }

  getUserName(req) {
    const clientInfo = this.parseClientInfo(req);
    if (!clientInfo.userName)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return clientInfo.userName;
  }

  getSSOProviders(req) {
    const clientInfo = this.parseClientInfo(req);
    if (!clientInfo.ssoProviders)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return clientInfo.ssoProviders;
  }

  getUserMail(req) {
    const clientInfo = this.parseClientInfo(req);
    if (!clientInfo.email)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return clientInfo.email;
  }

  getRefreshToken(req) {
    const token = req.cookies.refreshToken;
    if (!token)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return token;
  }

  getServiceGmail(req) {
    const email = req.cookies.registerEmail ?? req.cookies.forgotEmail;
    if (!email)
      throw new ErrorResponse(
        Constants.MESSAGES._UNAUTHORIZED,
        Constants.UNAUTHORIZED
      );
    return email;
  }

  /**
   * Get cookie options based on environment
   * @param {number} maxAge - Cookie max age in milliseconds
   * @returns {Object} Cookie options
   */
  getCookieOptions(maxAge = undefined) {
    const isProduction = config.NODE_ENV === "production";

    const frontendUrl = config.FRONTEND_URL || "http://localhost:3000";
    const backendUrl = config.BASE_URL || "http://localhost:8000";

    const frontendDomain = new URL(frontendUrl).hostname;
    const backendDomain = new URL(backendUrl).hostname;
    const isSameDomain = frontendDomain === backendDomain;

    // PRODUCTION FIX: For cross-subdomain (heki.aipencil.ai ↔ sever-heki.aipencil.ai)
    // We MUST use SameSite=None with Secure=true
    const options = {
      httpOnly: true,
      secure: isProduction, // true in production (required for SameSite=None)
      sameSite: isProduction && !isSameDomain ? "None" : "Lax", // None for cross-subdomain
      path: "/",
      ...(maxAge && { maxAge }),
    };

    // Add maxAge if provided
    if (maxAge !== undefined) {
      options.maxAge = maxAge;
    }

    // PRODUCTION: Set domain for cross-subdomain cookie sharing
    if (isProduction) {
      // Priority 1: Use explicit COOKIE_DOMAIN from .env (e.g., .aipencil.ai)
      if (config.COOKIE_DOMAIN) {
        options.domain = config.COOKIE_DOMAIN;
        console.log("🍪 Using COOKIE_DOMAIN from env:", options.domain);
      }
      // Priority 2: Use FRONTEND_DOMAIN from .env (e.g., aipencil.ai)
      else if (config.FRONTEND_DOMAIN) {
        let domain = config.FRONTEND_DOMAIN;
        // Ensure it starts with dot for subdomain support
        if (!domain.startsWith(".")) {
          domain = `.${domain}`;
        }
        options.domain = domain;
        console.log("🍪 Using FRONTEND_DOMAIN from env:", options.domain);
      }
      // Priority 3: Auto-extract from frontend URL
      else if (frontendDomain.includes(".")) {
        const domainParts = frontendDomain.split(".");
        if (domainParts.length >= 2) {
          // Extract root domain (e.g., aipencil.ai from heki.aipencil.ai)
          options.domain = "." + domainParts.slice(-2).join(".");
          console.log("🍪 Auto-extracted domain:", options.domain);
        }
      }
    }

    // ALWAYS log in production for debugging
    if (isProduction || config.NODE_ENV === "development" || process.env.DEBUG_COOKIES) {
      console.log("🍪 Cookie Options:", {
        environment: config.NODE_ENV,
        frontendUrl: frontendUrl,
        backendUrl: backendUrl,
        isSameDomain: isSameDomain,
        secure: options.secure,
        sameSite: options.sameSite,
        domain: options.domain || "not set (browser default)",
        httpOnly: options.httpOnly,
        path: options.path,
        maxAge: options.maxAge
          ? `${Math.round(options.maxAge / 1000)}s`
          : "session",
      });
    }

    return options;
  }

  /**
   * Set authentication cookies (access + refresh tokens)
   * @param {Response} res - Express response object
   * @param {Object} tokens - Tokens object { accessToken, refreshToken }
   * @param {Object} clientInfo - Client information to store
   */
  setAuthCookies(res, tokens, clientInfo = null) {
    const isProduction = config.NODE_ENV === "production";
    
    // Set access token (short-lived)
    const accessTokenMaxAge = this.parseExpiry(config.JWT_EXPIRES_IN);
    const accessCookieOptions = this.getCookieOptions(accessTokenMaxAge);
    res.cookie("accessToken", tokens.accessToken, accessCookieOptions);

    // Set refresh token (long-lived)
    const refreshTokenMaxAge = this.parseExpiry(config.JWT_REFRESH_EXPIRES_IN);
    const refreshCookieOptions = this.getCookieOptions(refreshTokenMaxAge);
    res.cookie("refreshToken", tokens.refreshToken, refreshCookieOptions);

    // Set client information (if provided)
    if (clientInfo) {
      const clientInfoMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      const clientCookieOptions = this.getCookieOptions(clientInfoMaxAge);
      res.cookie(
        "clientInformation",
        JSON.stringify(clientInfo),
        clientCookieOptions
      );
    }

    // Set CSRF token if provided
    if (tokens.csrfToken) {
      res.cookie("XSRF-TOKEN", tokens.csrfToken, {
        ...this.getCookieOptions(accessTokenMaxAge),
        httpOnly: false, // CSRF token needs to be read by JS
      });
    }

    // PRODUCTION: ALWAYS log cookie setting for debugging
    if (isProduction || config.NODE_ENV === "development" || process.env.DEBUG_COOKIES) {
      console.log("✅ Authentication cookies set successfully:", {
        accessToken: tokens.accessToken ? "SET (" + tokens.accessToken.substring(0, 20) + "...)" : "MISSING",
        refreshToken: tokens.refreshToken ? "SET (" + tokens.refreshToken.substring(0, 20) + "...)" : "MISSING",
        clientInfo: clientInfo ? "SET (id: " + clientInfo.id + ")" : "NOT_PROVIDED",
        csrfToken: tokens.csrfToken ? "SET" : "NOT_PROVIDED",
      });
      console.log("🍪 Cookie options used:", {
        accessToken: accessCookieOptions,
        refreshToken: refreshCookieOptions,
      });
    }
  }

  /**
   * Clear authentication cookies
   * @param {Response} res - Express response object
   */
  clearAuthCookies(res) {
    const isProduction = config.NODE_ENV === "production";
    
    // Get cookie options without maxAge for clearing
    const cookieOptions = this.getCookieOptions();

    // CRITICAL: For clearing cookies, we must match the EXACT options used when setting
    // This includes domain, path, secure, sameSite
    const clearOptions = {
      ...cookieOptions,
      maxAge: 0, // Expire immediately
      expires: new Date(0), // Set to epoch time
    };

    // Clear all auth-related cookies
    const cookieNames = ["accessToken", "refreshToken", "clientInformation", "XSRF-TOKEN"];
    
    cookieNames.forEach((cookieName) => {
      res.clearCookie(cookieName, clearOptions);
    });

    // PRODUCTION: ALWAYS log cookie clearing for debugging
    if (isProduction || config.NODE_ENV === "development" || process.env.DEBUG_COOKIES) {
      console.log("🗑️ Authentication cookies cleared:", {
        cookies: cookieNames,
        options: clearOptions,
      });
    }
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
      maxAge: expiryMinutes * 60 * 1000,
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
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  /**
   * Set client information cookie
   * @param {Response} res - Express response object
   * @param {Object} clientInfo - Client information
   */
  setClientInfo(res, clientInfo) {
    const clientInfoMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    res.cookie(
      "clientInformation",
      JSON.stringify(clientInfo),
      this.getCookieOptions(clientInfoMaxAge)
    );
  }

  /**
   * Get cookie debug information
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      environment: config.NODE_ENV,
      cookieSettings: {
        secure: config.NODE_ENV === "production",
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        domain: config.COOKIE_DOMAIN || config.FRONTEND_DOMAIN || "not set",
      },
      configuration: {
        frontendUrl: config.FRONTEND_URL,
        frontendDomain: config.FRONTEND_DOMAIN,
        cookieDomain: config.COOKIE_DOMAIN,
        corsOrigin: config.CORS_ORIGIN,
        baseUrl: config.BASE_URL,
      },
    };
  }

  /**
   * Validate cookie configuration for production
   * @returns {Object} Validation result
   */
  validateConfiguration() {
    const issues = [];
    const warnings = [];

    if (config.NODE_ENV === "production") {
      // Critical production requirements
      if (!config.FRONTEND_URL || !config.FRONTEND_URL.startsWith("https://")) {
        issues.push("FRONTEND_URL must be HTTPS in production");
      }

      if (!config.FRONTEND_DOMAIN && !config.COOKIE_DOMAIN) {
        issues.push(
          "FRONTEND_DOMAIN or COOKIE_DOMAIN must be set for cross-site cookies in production"
        );
      }

      if (
        !config.CORS_ORIGIN ||
        !Array.isArray(config.CORS_ORIGIN) ||
        !config.CORS_ORIGIN.some((origin) => origin.startsWith("https://"))
      ) {
        issues.push("CORS_ORIGIN must include HTTPS URLs in production");
      }

      // Warnings for better configuration
      if (config.COOKIE_DOMAIN && !config.COOKIE_DOMAIN.startsWith(".")) {
        warnings.push(
          "COOKIE_DOMAIN should start with . for subdomain support (e.g., .example.com)"
        );
      }

      if (config.FRONTEND_DOMAIN && !config.FRONTEND_DOMAIN.includes(".")) {
        warnings.push(
          "FRONTEND_DOMAIN should be a proper domain (e.g., example.com)"
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      debugInfo: this.getDebugInfo(),
    };
  }

  /**
   * Test cookie functionality
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} Test results
   */
  testCookies(req, res) {
    const testValue = `test_${Date.now()}`;
    const testCookieName = "cookieTest";

    // Set test cookie
    res.cookie(testCookieName, testValue, this.getCookieOptions(60000)); // 1 minute

    // Try to read existing cookies
    const existingCookies = req.cookies || {};

    return {
      testCookieSet: testValue,
      existingCookies: Object.keys(existingCookies),
      cookieOptions: this.getCookieOptions(),
      canReadCookies: Object.keys(existingCookies).length > 0,
      userAgent: req.headers["user-agent"],
      origin: req.headers.origin,
      referer: req.headers.referer,
    };
  }
}

module.exports = new CookieHelper();
