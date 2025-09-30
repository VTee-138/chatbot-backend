require('dotenv').config();

module.exports = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL,
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  JWT_VALIDATE_SECRET: process.env.JWT_VALIDATE_SECRET,
  JWT_VALIDATE_EXPIRES_IN: process.env.JWT_VALIDATE_EXPIRES_IN || '40s',
  JWT_2FA_SECRET: process.env.JWT_2FA_SECRET,
  JWT_2FA_EXPIRES_IN: process.env.JWT_2FA_EXPIRES_IN,
  // API Configuration
  API_VERSION: process.env.API_VERSION || 'v1',
  API_PREFIX: process.env.API_PREFIX || '/api',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  
  // API Key Settings
  API_KEY_LENGTH: parseInt(process.env.API_KEY_LENGTH) || 32,
  
  // Pagination
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE) || 100,

  // REDIS
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PASS: process.env.REDIS_PASS,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_STORE_SECRET: process.env.REDIS_STORE_SECRET,

  // NODE MAILER
  USER_MAIL: process.env.USER_MAIL,
  APP_PASSWORD: process.env.APP_PASSWORD,

  // Google AI Pencil Acc
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,

  // Facebok SSO
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  
  // Turnstile CAPTCHA
  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
  
  // Mail FE Link
  URL_MAIL_PUBLIC : process.env.URL_MAIL_PUBLIC,
  
  // OAuth URLs
  BASE_URL: process.env.BASE_URL || 'http://localhost:8000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000'
}