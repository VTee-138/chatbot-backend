const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config');
const redis = require('../config/redis');

/**
 * Hash password using bcrypt
 * @param {String} password - Plain text password
 * @returns {Promise<String>} Hashed password
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, config.BCRYPT_ROUNDS);
};

/**
 * Compare password with hash
 * @param {String} password - Plain text password
 * @param {String} hash - Hashed password
 * @returns {Promise<Boolean>} Comparison result
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate API key
 * @param {Number} length - Key length (default from config)
 * @returns {String} API key
 */
const generateApiKey = (length = config.API_KEY_LENGTH) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash API key
 * @param {String} apiKey - Plain API key
 * @returns {String} Hashed API key
 */
const hashApiKey = (apiKey) => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

/**
 * Generate random string
 * @param {Number} length - String length
 * @returns {String} Random string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Create slug from string
 * @param {String} text - Input text
 * @returns {String} Slug
 */
const createSlug = (text) => {
  return text
    .normalize("NFD")                   // tách chữ + dấu
    .replace(/[\u0300-\u036f]/g, "")    // xóa toàn bộ dấu
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')           // xóa ký tự đặc biệt
    .replace(/[\s_-]+/g, '.')           // thay khoảng trắng bằng .
    .replace(/^-+|-+$/g, '');           // bỏ - ở đầu/cuối
};

const generateMultipleSlugs = (slug) => {
  const recommendSlug = slug + ' ' + crypto.randomBytes(4).toString('hex')
  return createSlug(recommendSlug)
}
/**
 * Create shield key to prevent email injection, then set in Redis for a time
 * @param {Integer} length - Input Num
 * @param {String} email - Input Text
 * @param {Integer} expiresIn - Input Num (seconds)
 * @returns {String} Shield key
 */
const createShield = (length) => {
  const shield = generateApiKey(length)
  return shield
}

const convertToAscii = (str) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "")
    .toLowerCase();
}
module.exports = {
  hashPassword,
  comparePassword,
  generateApiKey,
  hashApiKey,
  generateRandomString,
  createSlug,
  createShield,
  convertToAscii,
  generateMultipleSlugs
};
