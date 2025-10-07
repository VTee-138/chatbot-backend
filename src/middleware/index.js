const { Constants } = require('../utils/constant');
const { errorResponse, httpOnlyRevoke } = require('../utils/response');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  if (err.isOperational){
    // Clear user not available
    if ( err.message === Constants.MESSAGES._UNAUTHORIZED){
      // Clear user information
      httpOnlyRevoke(res, "refresh")
      httpOnlyRevoke(res, "clientInformation")
      return errorResponse(res, Constants.MESSAGES._UNAUTHORIZED, Constants.UNAUTHORIZED)
    }
    if ( err.message.includes("Cannot destructure property")){
      return errorResponse(res, "Check your property!", Constants.BAD_REQUEST)
    }
    if (err.message.includes("Invalid token signature:")){
      return errorResponse(res,"Your signature isn't valid",Constants.BAD_REQUEST)
    }
    // Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
      switch (err.code) {
        case 'P2002':
          return errorResponse(res, 'Duplicate entry. Resource already exists.', 409);
        case 'P2025':
          return errorResponse(res, 'Resource not found.', 404);
        case 'P2003':
          return errorResponse(res, 'Foreign key constraint failed.', 400);
        default:
          return errorResponse(res, 'Database error occurred.', 500);
      }
    }
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    }
    
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired.', 401);
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return errorResponse(res, 'Validation failed.', 400, errors);
    }
  }
  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  return errorResponse(res, message, statusCode);
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
  return errorResponse(res, `Route ${req.originalUrl} not found.`, 404);
};

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    console.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms - ${ip}`);
  });
  
  next();
};

/**
 * Validate request body middleware
 * @param {Function} schema - Validation schema function
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema(req.body);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return errorResponse(res, 'Validation failed', 400, errors);
    }
    
    req.body = value;
    next();
  };
};

/**
 * Validate query parameters middleware
 * @param {Function} schema - Validation schema function
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema(req.query);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return errorResponse(res, 'Query validation failed', 400, errors);
    }
    
    req.query = value;
    next();
  };
};

/**
 * Validate URL parameters middleware
 * @param {Function} schema - Validation schema function
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema(req.params);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return errorResponse(res, 'Parameter validation failed', 400, errors);
    }
    
    req.params = value;
    next();
  };
};

module.exports = {
  errorHandler,
  notFound,
  requestLogger,
  validateBody,
  validateQuery,
  validateParams,
};
