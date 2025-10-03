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
const httpOnlyResponse = (res, tag, data = null, expiresInMs= 60*1000) =>{ 
  const cookieOptions = {
    httpOnly: true,  
    maxAge: expiresInMs,
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',  // CRITICAL: Must match when clearing cookies
  };
  
  // Add domain only in production if needed
  if (config.NODE_ENV === 'production' && config.COOKIE_DOMAIN) {
    cookieOptions.domain = config.COOKIE_DOMAIN;
  }
  
  res.cookie(tag, data, cookieOptions);
}

const httpOnlyRevoke = (res, tag) => {
  const cookieOptions = {
    httpOnly: true,  
    secure: config.NODE_ENV === 'production',
    sameSite: config.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/'  // CRITICAL: Must match when setting cookies
  };
  
  // Add domain only in production if needed
  if (config.NODE_ENV === 'production' && config.COOKIE_DOMAIN) {
    cookieOptions.domain = config.COOKIE_DOMAIN;
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
