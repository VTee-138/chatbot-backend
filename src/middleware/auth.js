const { verifyToken } = require('../utils/jwt');
const { errorResponse, httpOnlyRevoke } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');

/**
 * Authentication middleware - verify JWT Access Token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access token is required', 401);
    }
    if (!req.cookies.clientInformation) {
      httpOnlyRevoke(res, "refreshToken")
      httpOnlyRevoke(res, "clientInformation")
      return errorResponse(res, 'Missing client information', 401);
    }
    const token = authHeader.substring(7);
    try {
      const decoded = verifyToken(token, 'access');
      const clientInformation = JSON.parse(req.cookies.clientInformation)
      if (clientInformation.id !== decoded.id)
      return errorResponse(res, 'This user not available', 401);
      next();
    } 
    catch (jwtError) {
      console.error("ERROR JWT MIDDLEWARE: ", jwtError.message)
      return errorResponse(res, 'Invalid or expired token', 401); 
    }
  } 
  catch (error) {
    console.error('Authentication error:', error);
    return errorResponse(res, 'Authentication failed', 500);
  }
};

/**
 * Authorization middleware - check user roles
 * @param {Array} roles - Allowed roles
 */
const authorize = (roles = []) => {
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
const requireOrganizationMember = (roles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return errorResponse(res, 'Authentication required', 401);
      }
      
      const { organizationId } = req.params;
      
      if (!organizationId) {
        return errorResponse(res, 'Organization ID is required', 400);
      }
      
      const membership = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.id,
            organizationId,
          },
        },
        include: {
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
      
      if (!membership) {
        return errorResponse(res, 'You are not a member of this organization', 403);
      }
      
      if (!membership.organization.isActive) {
        return errorResponse(res, 'Organization is disabled', 403);
      }
      
      if (roles.length && !roles.includes(membership.role)) {
        return errorResponse(res, 'Insufficient organization permissions', 403);
      }
      
      req.organization = membership.organization;
      req.organizationRole = membership.role;
      
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


module.exports = {
  authenticate,
  authorize,
  authenticateApiKey,
  requireOrganizationMember,
  isAccountForgotExists,
  generalLimiter,
  authLimiter
};
