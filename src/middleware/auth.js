const { verifyToken } = require('../utils/jwt');
const { errorResponse, httpOnlyRevoke, catchAsync } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');
const process = require('../config');
const { ErrorResponse, Constants } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');
const userCredentialModel = require('../model/userCredentialModel');
const { rateLimiterGeneral, rateLimiterAuth } = require('../config/limiter');
const groupDBServices = require('../services/groupDBServices');

/**
 * Authentication middleware - verify JWT Access Token
 */
const authenticate = async (req, res, next) => {
  try {
    if (process.NODE_ENV === 'development') {
      req.user = { id: 'cmfmj99ph0000upx88pjfrot4', email: 'local@test.com' };
      req.mfa = true // fake user
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access token is required', 401);
    }

    if (!req.cookies.clientInformation) {
      throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyToken(token, 'access');
      const clientId = cookieHelper.getClientId(req);
      if (clientId !== decoded.id) {
        throw new ErrorResponse(Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED);
      }

      // 👇 Quan trọng: gắn user vào request
      req.user = {
        id: decoded.id,
        email: decoded.email, // nếu có
        role: decoded.role || null,
      };

      next();
    } catch (jwtError) {
      console.error("ERROR JWT MIDDLEWARE: ", jwtError.message);
      return errorResponse(res, 'Invalid or expired token', 401); 
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return errorResponse(res, 'Authentication failed', 500);
  }
};
const authenticate2FA = catchAsync(async (req, res, next) => {
    if (process.NODE_ENV === 'development') {
      req.user = { id: 'cmfmj99ph0000upx88pjfrot4', email: 'local@test.com' };
      req.mfa = true // fake user
      return next();
    }
  let token;
  // Lấy token từ header Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, "Authentication token required", Constants.UNAUTHORIZED);
  }

  try {
    const decoded = verifyToken(token, '2fa');
    // Gắn userId vào request để controller sau có thể sử dụng
    req.userId = decoded.id;
    req.mfa = true
    next();
  } catch (error) {
    // Handle JWT errors (expired, invalid signature, etc.)
    next(error)
  }
});
/**
 * Authorization middleware - check user roles
 * @param {Array} roles - Allowed roles
 */
const authorize = (roles = []) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return errorResponse(res, 'Insufficient permissions', 403);
    }
    next();
  };
};

/**
 * API Key authentication middleware
 */
const authenticateApiKey = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return errorResponse(res, 'API key is required', 401);
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
            slug: true,
            isActive: true,
          },
        },
      },
    });
    
    if (!apiKeyRecord) {
      return errorResponse(res, 'Invalid API key', 401);
    }
    
    if (!apiKeyRecord.user.isActive) {
      return errorResponse(res, 'API key owner account is disabled', 401);
    }
    
    if (apiKeyRecord.organization && !apiKeyRecord.organization.isActive) {
      return errorResponse(res, 'Organization is disabled', 401);
    }
    
    // Check if API key is expired
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return errorResponse(res, 'API key has expired', 401);
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
    return errorResponse(res, 'API key authentication failed', 500);
  }
};
const isAccountForgotExists = async (req, res, next) => {
  const { email } = req.body
  req.email = email
  const user = await prisma.user.findUnique({
    where : {email : email}
  })
  if (!user) return errorResponse(res, 'This user is not available', 400)
  next()
}
/**
 * Organization member middleware - check if user is member of organization
 * @param {Array} roles - Required organization roles
 */
const requireGroupMember = (roles = []) => {
  return async (req, res, next) => {
    try {
      // if (!req.user) {
      //   return errorResponse(res, 'Authentication required', 401);
      // }
      const clientId = cookieHelper.getClientId(req)
      const { id } = req.params;
      
      if (!id) {
        return errorResponse(res, 'Group ID is required', 400);
      }
      
      const membership = await groupDBServices.getMemberInformation(clientId, id)
      
      if (!membership) {
        return errorResponse(res, 'You are not a member of this organization', 403);
      }
      
      // if (!membership.organization.isActive) {
      //   return errorResponse(res, 'Organization is disabled', 403);
      // }
      
      if (roles.length && !roles.includes(membership.role)) {
        return errorResponse(res, 'Insufficient organization permissions', 403);
      }
      
      req.groupId = membership.groupId;
      req.groupRole = membership.role;
      
      next();
    } catch (error) {
      console.error('Organization membership error:', error);
      return errorResponse(res, 'Organization access check failed', 500);
    }
  };
}
  const generalLimiter = async (req, res, next) => {
    try {
        await rateLimiterGeneral.consume(req.ip)
        next()
    } catch (error) {
        res.status(429).json({
            message: 'Too Many Requests',
            retryAfter: Math.round(error.msBeforeNext / 1000)
        });
    }
}
const authLimiter = async (req, res, next) => {
    try {
        await rateLimiterAuth.consume(req.ip)
        next();
    }
    catch (rejRes) {
        res.status(429).json({
            message: 'Too Many Login/Register Attempts',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000)
        });
    }
}
const is2FAEnabled = catchAsync( async (req, res, next) =>{
  
})
module.exports = {
  authenticate2FA,
  authenticate,
  authorize,
  authenticateApiKey,
  requireGroupMember,
  isAccountForgotExists,
  generalLimiter,
  authLimiter
};
