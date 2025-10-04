const config = require('../config');

/**
 * Success response helper
 * @param {Object} res - Express response object
 * @param {Any} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
  };
  
  return res.status(statusCode).json(response);
};

/**
 * httpOnly response helper
 * @param {Object} res - Express response object
 * @param {Any} tag - tag want to store in client 
 * @param {Any} data - data stored in tag
 * @param {String} expiresInMs - 60000 ms ~~ 1 minute, time to expire
 * @param {Number} statusCode - HTTP status code
 */
const httpOnlyResponse = (res, tag, data = null, expiresInMs = 60 * 1000) => {
  const isProduction = config.NODE_ENV === 'production';
  
  // Base cookie options
  const cookieOptions = {
    httpOnly: true,
    maxAge: expiresInMs,
    path: '/',
    secure: isProduction ? config.COOKIE_SECURE : false,
    sameSite: isProduction ? 'none' : 'lax'
  };
  
  // Production-specific domain configuration
  if (isProduction) {
    // If FRONTEND_DOMAIN is set, use it for domain
    if (config.FRONTEND_DOMAIN) {
      // Extract domain from URL if needed
      let domain = config.FRONTEND_DOMAIN;
      if (domain.includes('://')) {
        domain = new URL(domain).hostname;
      }
      // Add dot prefix for subdomain support
      cookieOptions.domain = domain.startsWith('.') ? domain : `.${domain}`;
    }
    
    // Override with explicit COOKIE_DOMAIN if set
    if (config.COOKIE_DOMAIN) {
      cookieOptions.domain = config.COOKIE_DOMAIN;
    }
  }
  
  // Log cookie configuration in development
  if (config.NODE_ENV === 'development') {
    console.log(`🍪 Setting cookie [${tag}]:`, {
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      domain: cookieOptions.domain || 'not set',
      httpOnly: cookieOptions.httpOnly,
      maxAge: `${Math.round(cookieOptions.maxAge / 1000)}s`
    });
  }
  
  res.cookie(tag, data, cookieOptions);
}

const httpOnlyRevoke = (res, tag) => {
  const isProduction = config.NODE_ENV === 'production';
  
  // Cookie options must match exactly with httpOnlyResponse
  const cookieOptions = {
    httpOnly: true,
    path: '/',
    secure: isProduction ? config.COOKIE_SECURE : false,
    sameSite: isProduction ? 'none' : 'lax'
  };
  
  // Production-specific domain configuration (must match setting)
  if (isProduction) {
    if (config.FRONTEND_DOMAIN) {
      let domain = config.FRONTEND_DOMAIN;
      if (domain.includes('://')) {
        domain = new URL(domain).hostname;
      }
      cookieOptions.domain = domain.startsWith('.') ? domain : `.${domain}`;
    }
    
    if (config.COOKIE_DOMAIN) {
      cookieOptions.domain = config.COOKIE_DOMAIN;
    }
  }
  
  // Log cookie revocation in development
  if (config.NODE_ENV === 'development') {
    console.log(`🗑️ Clearing cookie [${tag}]:`, {
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      domain: cookieOptions.domain || 'not set',
      httpOnly: cookieOptions.httpOnly
    });
  }
  
  res.clearCookie(tag, cookieOptions);
}

/**
 * Error response helper
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code
 * @param {Array} errors - Validation errors array
 */
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  // Don't expose internal errors in production
  if (statusCode === 500 && config.NODE_ENV === 'production') {
    response.message = 'Internal Server Error';
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Paginated response helper
 * @param {Object} res - Express response object
 * @param {Array} data - Response data
 * @param {Number} total - Total count
 * @param {Number} page - Current page
 * @param {Number} limit - Items per page
 * @param {String} message - Success message
 */
const paginatedResponse = (res, data, total, page, limit, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  const response = {
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
  return res.status(200).json(response);
};


/**
 * Validation error response helper
 * @param {Object} res - Express response object
 * @param {Array} errors - Validation errors
 */
const validationErrorResponse = (res, errors) => {
  return errorResponse(res, 'Validation failed', 400, errors);
};


/**
 * Catch async errors wrapper
 * @param {Function} fn - Async function
 * @returns {Function} Express middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
  catchAsync,
  httpOnlyResponse,
  httpOnlyRevoke
};
