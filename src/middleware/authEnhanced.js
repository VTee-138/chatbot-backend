const { verifyToken } = require('../utils/jwt');
const { errorResponse, catchAsync } = require('../utils/response');
const { ErrorResponse, Constants } = require('../utils/constant');
const redis = require('../config/redis');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Enhanced Authentication Middleware
 * Provides better token management, blacklist checking, and session validation
 */
class AuthMiddleware {
  /**
   * Extract token from request
   * Priority: 1) Authorization header, 2) Cookies, 3) Query params (not recommended)
   */
  static extractToken(req, type = 'access') {
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return { token: authHeader.substring(7), source: 'header' };
    }

    // 2. Check cookies
    const cookieName = type === 'refresh' ? 'refreshToken' : 'accessToken';
    if (req.cookies && req.cookies[cookieName]) {
      return { token: req.cookies[cookieName], source: 'cookie' };
    }

    // 3. Check query params (not recommended, only for special cases)
    if (req.query && req.query.token) {
      logger.warn('⚠️  Token passed via query parameter - not recommended for security');
      return { token: req.query.token, source: 'query' };
    }

    return { token: null, source: null };
  }

  /**
   * Verify access token with enhanced security checks
   */
  static verifyToken = catchAsync(async (req, res, next) => {
    const { token, source } = this.extractToken(req, 'access');
    
    if (!token) {
      logger.error('❌ No token provided');
      throw new ErrorResponse('Access token is required. Please login again.', Constants.UNAUTHORIZED);
    }

    // Check if token is blacklisted (revoked)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.warn('⚠️  Attempted to use blacklisted token');
      throw new ErrorResponse('Token has been revoked. Please login again.', Constants.UNAUTHORIZED);
    }

    try {
      // Verify JWT token
      const decoded = verifyToken(token, 'access');
      
      // Check token expiry
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        throw new ErrorResponse('Token expired', Constants.UNAUTHORIZED);
      }

      // Validate session if sessionId is present
      if (decoded.sessionId) {
        const session = await redis.get(`session:${decoded.sessionId}`);
        if (!session) {
          logger.warn(`⚠️  Session not found for user ${decoded.id}`);
          throw new ErrorResponse('Session expired. Please login again.', Constants.UNAUTHORIZED);
        }

        // Update session activity
        await redis.setex(
          `session:${decoded.sessionId}`,
          config.SESSION_MAX_AGE / 1000,
          JSON.stringify({ userId: decoded.id, lastActivity: Date.now() })
        );
      }

      // Set user information
      req.user = {
        id: decoded.id,
        email: decoded.email,
        userName: decoded.userName,
        role: decoded.role,
        ssoProviders: decoded.ssoProviders || [],
        needsOnboarding: decoded.needsOnboarding || false,
        activeGroup: decoded.activeGroup || null,
        sessionId: decoded.sessionId
      };

      logger.debug(`✅ Authentication successful via ${source} for user ${decoded.email}`);
      next();

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        logger.error('❌ Invalid token format');
        throw new ErrorResponse('Invalid access token format', Constants.UNAUTHORIZED);
      }
      if (error.name === 'TokenExpiredError') {
        logger.error('❌ Token expired');
        throw new ErrorResponse('Access token has expired. Please refresh your token.', Constants.UNAUTHORIZED);
      }
      throw error;
    }
  });

  /**
   * Verify refresh token
   */
  static verifyRefreshToken = catchAsync(async (req, res, next) => {
    const { token, source } = this.extractToken(req, 'refresh');
    
    if (!token) {
      logger.error('❌ No refresh token provided');
      throw new ErrorResponse('Refresh token is required', Constants.UNAUTHORIZED);
    }

    try {
      const decoded = verifyToken(token, 'refresh');
      
      // Check if refresh token is stored in Redis
      const storedToken = await redis.get(`refresh:${decoded.id}`);
      if (storedToken !== token) {
        logger.warn(`⚠️  Invalid refresh token for user ${decoded.id}`);
        throw new ErrorResponse('Invalid refresh token', Constants.UNAUTHORIZED);
      }

      req.user = {
        id: decoded.id,
        email: decoded.email
      };

      logger.debug(`✅ Refresh token verified for user ${decoded.email}`);
      next();

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new ErrorResponse('Invalid refresh token', Constants.UNAUTHORIZED);
      }
      if (error.name === 'TokenExpiredError') {
        throw new ErrorResponse('Refresh token expired. Please login again.', Constants.UNAUTHORIZED);
      }
      throw error;
    }
  });

  /**
   * Verify 2FA token
   */
  static verify2FAToken = catchAsync(async (req, res, next) => {
    const { token } = this.extractToken(req, 'access');
    
    if (!token) {
      throw new ErrorResponse('2FA token is required', Constants.UNAUTHORIZED);
    }

    try {
      const decoded = verifyToken(token, '2fa');
      
      req.userId = decoded.id;
      req.mfa = true;
      
      logger.debug(`✅ 2FA token verified for user ${decoded.id}`);
      next();

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ErrorResponse('2FA token expired. Please request a new code.', Constants.UNAUTHORIZED);
      }
      throw new ErrorResponse('Invalid 2FA token', Constants.UNAUTHORIZED);
    }
  });

  /**
   * Optional authentication (doesn't fail if no token)
   */
  static optionalAuth = async (req, res, next) => {
    try {
      const { token } = this.extractToken(req, 'access');
      
      if (token) {
        const decoded = verifyToken(token, 'access');
        req.user = {
          id: decoded.id,
          email: decoded.email,
          userName: decoded.userName,
          role: decoded.role
        };
      }
    } catch (error) {
      // Ignore errors for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
    next();
  };

  /**
   * Require specific role(s)
   */
  static requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return errorResponse(res, 'Authentication required', Constants.UNAUTHORIZED);
      }

      if (!roles.includes(req.user.role)) {
        logger.warn(`⚠️  User ${req.user.email} attempted to access role-restricted resource`);
        return errorResponse(res, 'Insufficient permissions', Constants.FORBIDDEN);
      }

      next();
    };
  }

  /**
   * Revoke token (add to blacklist)
   */
  static async revokeToken(token, expirySeconds) {
    try {
      await redis.setex(`blacklist:${token}`, expirySeconds, '1');
      logger.info('🔒 Token revoked and added to blacklist');
    } catch (error) {
      logger.error('Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * Create session in Redis
   */
  static async createSession(sessionId, userId, expirySeconds) {
    try {
      await redis.setex(
        `session:${sessionId}`,
        expirySeconds,
        JSON.stringify({ userId, createdAt: Date.now() })
      );
      logger.info(`✅ Session created for user ${userId}`);
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Destroy session
   */
  static async destroySession(sessionId) {
    try {
      await redis.del(`session:${sessionId}`);
      logger.info('🔒 Session destroyed');
    } catch (error) {
      logger.error('Failed to destroy session:', error);
      throw error;
    }
  }

  /**
   * Store refresh token in Redis
   */
  static async storeRefreshToken(userId, token, expirySeconds) {
    try {
      await redis.setex(`refresh:${userId}`, expirySeconds, token);
      logger.info(`✅ Refresh token stored for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
      throw error;
    }
  }

  /**
   * Remove refresh token from Redis
   */
  static async removeRefreshToken(userId) {
    try {
      await redis.del(`refresh:${userId}`);
      logger.info(`🔒 Refresh token removed for user ${userId}`);
    } catch (error) {
      logger.error('Failed to remove refresh token:', error);
      throw error;
    }
  }
}

module.exports = AuthMiddleware;
