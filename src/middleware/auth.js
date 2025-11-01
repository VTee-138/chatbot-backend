const { verifyToken } = require('../utils/jwt');
const { errorResponse, httpOnlyRevoke, catchAsync } = require('../utils/response');
const prisma = require('../config/database');
const redis = require('../config/redis');
const process = require('../config');
const { ErrorResponse, Constants } = require('../utils/constant');
const cookieHelper = require('../utils/cookieHelper');
const userCredentialModel = require('../model/userCredentialModel');
const { rateLimiterGeneral, rateLimiterAuth } = require('../config/limiter');

/**
 * Authentication middleware - verify JWT Access Token
 * Supports both Authorization header (JWT) and cookie-based auth
 */
const authenticate = (req, res, next) => {
  try {
    // req.user = { id: "7cff26a0-0fe1-4b3c-a8cc-cc440b17fd97" };
    // next()
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication token is required', 401);
    }

    const token = authHeader.substring(7); // Bỏ đi "Bearer "

    // Giả sử bạn có một secret key được lưu trong biến môi trường
    const decodedPayload = verifyToken(token, process.JWT_SECRET);

    // Gắn payload vào request để các hàm sau có thể dùng
    req.user = decodedPayload; // payload sẽ có dạng { id, email, userName, ... }

    next();
  } catch (error) {
    // Xử lý các lỗi token (hết hạn, không hợp lệ)
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired', 401);
    }
    return errorResponse(res, 'Invalid token', 401);
  }
};
const authenticate2FA = catchAsync(async (req, res, next) => {
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
            // slug: true,
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
    where: { email: email }
  })
  if (!user) return errorResponse(res, 'This user is not available', 400)
  next()
}
/**
 * Organization member middleware - check if user is member of organization
 * @param {Array} roles - Required organization roles
 */
// const requireGroupMember = (roles = []) => {
//   return async (req, res, next) => {
//     try {
//       // if (!req.user) {
//       //   return errorResponse(res, 'Authentication required', 401);
//       // }
//       const clientId = cookieHelper.getClientId(req)
//       const { grId } = req.params;

//       if (!grId) {
//         return errorResponse(res, 'Group ID is required', 400);
//       }

//       const membership = await groupDBServices.getMemberInformation(clientId, grId)

//       if (!membership) {
//         return errorResponse(res, 'You are not a member of this organization', 403);
//       }

//       // if (!membership.organization.isActive) {
//       //   return errorResponse(res, 'Organization is disabled', 403);
//       // }

//       if (roles.length && !roles.includes(membership.role)) {
//         return errorResponse(res, 'Insufficient organization permissions', 403);
//       }

//       req.groupId = membership.groupId;
//       req.groupRole = membership.role;

//       next();
//     } catch (error) {
//       console.error('Organization membership error:', error);
//       return errorResponse(res, 'Organization access check failed', 500);
//     }
//   };
// }
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
const is2FAEnabled = catchAsync(async (req, res, next) => {

})
module.exports = {
  authenticate2FA,
  authenticate,
  authorize,
  authenticateApiKey,
  // requireGroupMember,
  isAccountForgotExists,
  generalLimiter,
  authLimiter
};
