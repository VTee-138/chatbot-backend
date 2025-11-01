const { verifyToken } = require('../utils/jwt');
const { errorResponse, httpOnlyRevoke, catchAsync } = require('../utils/response');
const prisma = require('../config/database');
const { Constants } = require('../utils/constant');
const { rateLimiterGeneral, rateLimiterAuth } = require('../config/limiter');

const authenticate = (req, res, next) => {
  try {
    let token;
    
    // 1. Try to get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove "Bearer "
    }
    
    // 2. If no header token, try to get from cookie
    if (!token && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return errorResponse(res, 'Authentication token is required', Constants.UNAUTHORIZED);
    }

    // Verify token
    const decodedPayload = verifyToken(token, 'access');

    // Attach user info to request
    req.user = decodedPayload; // payload: { id, email, userName, role, ... }

    next();
  } catch (error) {
    // Handle token errors
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired', Constants.UNAUTHORIZED);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token', Constants.UNAUTHORIZED);
    }
    return errorResponse(res, 'Authentication failed', Constants.UNAUTHORIZED);
  }
};

const authenticate2FA = catchAsync(async (req, res, next) => {
  let token;
  
  // Get token from Authorization header: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, "Authentication token required", Constants.UNAUTHORIZED);
  }

  try {
    const decoded = verifyToken(token, '2fa');
    
    // Attach userId to request for later use
    req.userId = decoded.id;
    req.mfa = true;
    
    next();
  } catch (error) {
    // Handle JWT errors (expired, invalid signature, etc.)
    next(error);
  }
});

/**
 * Authorization middleware - check user roles
 * @param {Array} roles - Allowed roles
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', Constants.UNAUTHORIZED);
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return errorResponse(res, 'Insufficient permissions', Constants.FORBIDDEN);
    }
    
    next();
  };
};

/**
 * API Key authentication middleware
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return errorResponse(res, 'API key is required', Constants.UNAUTHORIZED);
    }

    // Hash the provided API key to compare with stored hash
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: {
        keyHash,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      return errorResponse(res, 'Invalid API key', Constants.UNAUTHORIZED);
    }

    if (!apiKeyRecord.user.isActive) {
      return errorResponse(res, 'API key owner account is disabled', Constants.UNAUTHORIZED);
    }

    if (apiKeyRecord.organization && !apiKeyRecord.organization.isActive) {
      return errorResponse(res, 'Organization is disabled', Constants.UNAUTHORIZED);
    }

    // Check if API key is expired
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return errorResponse(res, 'API key has expired', Constants.UNAUTHORIZED);
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsed: new Date() },
    });

    req.user = apiKeyRecord.user;
    req.organization = apiKeyRecord.organization;
    req.apiKey = apiKeyRecord;

    next();
  } catch (error) {
    console.error('API Key authentication error:', error);
    return errorResponse(res, 'API key authentication failed', Constants.INTERNAL_SERVER_ERROR);
  }
};

const isAccountForgotExists = async (req, res, next) => {
  const { email } = req.body;
  req.email = email;
  
  const user = await prisma.user.findUnique({
    where: { email: email }
  });
  
  if (!user) {
    return errorResponse(res, 'This user is not available', Constants.BAD_REQUEST);
  }
  
  next();
};

const generalLimiter = async (req, res, next) => {
  try {
    await rateLimiterGeneral.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).json({
      message: 'Too Many Requests',
      retryAfter: Math.round(error.msBeforeNext / 1000)
    });
  }
};

const authLimiter = async (req, res, next) => {
  try {
    await rateLimiterAuth.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      message: 'Too Many Login/Register Attempts',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
};

const is2FAEnabled = catchAsync(async (req, res, next) => {
  // Implementation for 2FA check if needed
  next();
});

module.exports = {
  authenticate2FA,
  authenticate,
  authorize,
  authenticateApiKey,
  isAccountForgotExists,
  generalLimiter,
  authLimiter,
  is2FAEnabled
};