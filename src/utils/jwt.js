const jwt = require('jsonwebtoken');
const config = require('../config');

const TOKEN_CONFIG = {
  access: {
    secret: config.JWT_SECRET,
    expiresIn: config.JWT_EXPIRES_IN,
  },
  refresh: {
    secret: config.JWT_REFRESH_SECRET,
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  },
  validate: {
    secret: config.JWT_VALIDATE_SECRET,
    expiresIn: config.JWT_VALIDATE_EXPIRES_IN,
  },
  '2fa': {
    secret: config.JWT_2FA_SECRET,
    expiresIn: config.JWT_2FA_EXPIRES_IN,
  },
}

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {String} type - Token type ('access' or 'refresh' or 'validate')
 * @returns {String} JWT token
 */
const generateToken = (payload, type = 'access') => {
  const { secret, expiresIn } = TOKEN_CONFIG[type] || TOKEN_CONFIG.access
  return jwt.sign(payload, secret, { expiresIn })
}

  /**
 * Verify JWT tokens
 * @param {String} token - JWT token
 * @param {String} type - Token type ('access' or 'refresh' or 'validate')
 * @returns {Object} Decoded token payload
 */ 
const verifyToken = (token, type = 'access') => {
  try {
    const { secret } = TOKEN_CONFIG[type] || TOKEN_CONFIG.access
    return jwt.verify(token, secret)
  } catch (error) {
    throw error
  }
}
/**
 * Decode to get payload, when you know token expired already
 * @param {String} token  - JWT Token
 */
const decodePayload = (token) => {
  const decoded = jwt.decode(token);
  if (!decoded) return null; // hoặc throw new Error("Invalid token")
  const { exp, iat, ...payload } = decoded;
  return payload;
};
/**
 * Generate tokens pair (access + refresh)
 * @param {Object} user - User object
 * @returns {Object} Tokens object
 */
const generateTokenPair = (user) => {
  return {
    accessToken: generateToken(user, 'access'),
    refreshToken: generateToken(user, 'refresh'),
  };
};

module.exports = {
  generateToken,
  verifyToken,
  decodePayload,
  generateTokenPair,
};
