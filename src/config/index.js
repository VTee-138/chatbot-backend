require('dotenv').config();

module.exports = {
  // Server Configuration
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT Configuration - FIX: Improved defaults and validation
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m', // Access token ngắn hạn để bảo mật
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  JWT_VALIDATE_SECRET: process.env.JWT_VALIDATE_SECRET || process.env.JWT_SECRET || 'your-validate-secret',
  JWT_VALIDATE_EXPIRES_IN: process.env.JWT_VALIDATE_EXPIRES_IN || '40s',
  JWT_2FA_SECRET: process.env.JWT_2FA_SECRET || process.env.JWT_SECRET || 'your-2fa-secret',
  JWT_2FA_EXPIRES_IN: process.env.JWT_2FA_EXPIRES_IN || '5m',

  // API Configuration
  API_VERSION: process.env.API_VERSION || 'v1',
  API_PREFIX: process.env.API_PREFIX || '/api',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

  // CORS Configuration - FIX: Support multiple origins
  CORS_ORIGIN: process.env.CORS_ORIGIN ?
    process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) :
    ['http://localhost:3001', 'http://localhost:3000'],

  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,

  // API Key Settings
  API_KEY_LENGTH: parseInt(process.env.API_KEY_LENGTH) || 32,

  // Pagination
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE) || 100,

  // REDIS - FIX: Improved configuration
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PASS: process.env.REDIS_PASS || '',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
  REDIS_STORE_SECRET: process.env.REDIS_STORE_SECRET || process.env.JWT_SECRET || 'redis-store-secret',
  REDIS_URL: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,

  // REDIS MQ
  REDIS_MQ_HOST: process.env.REDIS_MQ_HOST,
  REDIS_MQ_PASS: process.env.REDIS_MQ_PASSWORD || '',
  REDIS_MQ_PORT: parseInt(process.env.REDIS_MQ_PORT) || 6379,
  REDIS_MQ_URL: process.env.REDIS_MQ_URL || `redis://${process.env.REDIS_MQ_HOST || 'localhost'}:${process.env.REDIS_MQ_PORT || 6379}`,
  REDIS_MQ_DB: process.env.REDIS_MQ_DB || 0,

  // NODE MAILER
  USER_MAIL: process.env.USER_MAIL,
  APP_PASSWORD: process.env.APP_PASSWORD,

  // Google OAuth - FIX: Added callback URL default
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/v1/auth/google/callback',

  // Facebook OAuth - FIX: Added callback URL default
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  FACEBOOK_CALLBACK_URL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:8000/api/v1/auth/facebook/callback',

  // Turnstile CAPTCHA
  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,

  // Mail FE Link
  URL_MAIL_PUBLIC: process.env.NODE_ENV === 'production' ? process.env.URL_MAIL_PUBLIC : 'http://localhost:3001',
  ZALO_APP_SECRET: process.env.ZALO_APP_SECRET,
  ZALO_APP_ID: process.env.ZALO_APP_ID,
  // OAuth URLs
  BASE_URL: process.env.BASE_URL || 'http://localhost:8000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',

  // Cookie Configuration - Production Ready
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  COOKIE_HTTP_ONLY: true,
  COOKIE_PATH: '/',

  // Message Queue
  MQ_URL: process.env.RABBIT_URL || 'amqp://localhost',

  // Frontend Domain for Cookie (production)
  FRONTEND_DOMAIN: process.env.FRONTEND_DOMAIN || undefined,

  // Session Configuration
  SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000, // 7 days

  // Production Cookie Settings
  PRODUCTION_COOKIE_SETTINGS: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },

  // Development Cookie Settings  
  DEVELOPMENT_COOKIE_SETTINGS: {
    secure: false,
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}