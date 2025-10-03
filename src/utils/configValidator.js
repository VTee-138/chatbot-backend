const logger = require('./logger');

/**
 * Configuration Validator
 * Validates environment variables and configuration
 */
class ConfigValidator {
  /**
   * Validate configuration
   * @param {Object} config - Configuration object
   * @returns {boolean} - True if valid
   * @throws {Error} - If validation fails
   */
  static validate(config) {
    const errors = [];
    const warnings = [];

    // Check required environment variables
    const requiredVars = [
      { key: 'DATABASE_URL', value: config.DATABASE_URL },
      { key: 'REDIS_HOST', value: config.REDIS_HOST },
    ];

    requiredVars.forEach(({ key, value }) => {
      if (!value) {
        errors.push(`${key} is required`);
      }
    });

    // Check JWT secrets in production
    if (config.NODE_ENV === 'production') {
      if (config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
        errors.push('JWT_SECRET is using default value - SECURITY RISK!');
      }

      if (config.JWT_REFRESH_SECRET === 'your-refresh-secret-change-in-production') {
        errors.push('JWT_REFRESH_SECRET is using default value - SECURITY RISK!');
      }

      if (!config.USER_MAIL || !config.APP_PASSWORD) {
        warnings.push('Email configuration missing - email features will not work');
      }

      if (config.CORS_ORIGIN.includes('localhost')) {
        warnings.push('CORS_ORIGIN contains localhost in production environment');
      }

      if (!config.COOKIE_SECURE) {
        warnings.push('COOKIE_SECURE should be true in production');
      }
    }

    // Check JWT secret strength
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters for better security');
    }

    if (config.JWT_REFRESH_SECRET && config.JWT_REFRESH_SECRET.length < 32) {
      warnings.push('JWT_REFRESH_SECRET should be at least 32 characters for better security');
    }

    // Check bcrypt rounds
    if (config.BCRYPT_ROUNDS < 10) {
      warnings.push('BCRYPT_ROUNDS should be at least 10 for security');
    }

    if (config.BCRYPT_ROUNDS > 15) {
      warnings.push('BCRYPT_ROUNDS is very high - may impact performance');
    }

    // Check Redis configuration
    if (!config.REDIS_PORT || isNaN(config.REDIS_PORT)) {
      warnings.push('REDIS_PORT is not properly configured');
    }

    // Check rate limiting
    if (config.RATE_LIMIT_MAX_REQUESTS < 10) {
      warnings.push('RATE_LIMIT_MAX_REQUESTS is very low - may affect legitimate users');
    }

    // Check pagination
    if (config.MAX_PAGE_SIZE > 1000) {
      warnings.push('MAX_PAGE_SIZE is very high - may impact performance');
    }

    // Check OAuth configuration
    if (config.GOOGLE_CLIENT_ID && !config.GOOGLE_CLIENT_SECRET) {
      warnings.push('GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing');
    }

    if (config.FACEBOOK_APP_ID && !config.FACEBOOK_APP_SECRET) {
      warnings.push('FACEBOOK_APP_ID is set but FACEBOOK_APP_SECRET is missing');
    }

    // Log results
    if (errors.length > 0) {
      logger.error('❌ Configuration validation errors:');
      errors.forEach(error => logger.error(`  - ${error}`));
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    if (warnings.length > 0) {
      logger.warn('⚠️  Configuration warnings:');
      warnings.forEach(warning => logger.warn(`  - ${warning}`));
    }

    logger.info('✅ Configuration validation passed');
    return true;
  }

  /**
   * Log safe configuration (hide sensitive data)
   * @param {Object} config - Configuration object
   */
  static logConfig(config) {
    const safeConfig = { ...config };
    
    // Hide sensitive data
    const sensitiveKeys = [
      'JWT_SECRET', 
      'JWT_REFRESH_SECRET', 
      'JWT_VALIDATE_SECRET',
      'JWT_2FA_SECRET',
      'DATABASE_URL', 
      'REDIS_PASS', 
      'APP_PASSWORD',
      'GOOGLE_CLIENT_SECRET',
      'FACEBOOK_APP_SECRET',
      'TURNSTILE_SECRET',
      'REDIS_STORE_SECRET'
    ];

    sensitiveKeys.forEach(key => {
      if (safeConfig[key]) {
        const value = safeConfig[key];
        if (typeof value === 'string' && value.length > 0) {
          safeConfig[key] = value.substring(0, 4) + '***' + value.substring(value.length - 4);
        } else {
          safeConfig[key] = '***HIDDEN***';
        }
      }
    });

    logger.info('📋 Application Configuration:');
    logger.info(JSON.stringify(safeConfig, null, 2));
  }

  /**
   * Check if all required services are configured
   * @param {Object} config - Configuration object
   * @returns {Object} - Service status
   */
  static checkServices(config) {
    const services = {
      database: !!config.DATABASE_URL,
      redis: !!config.REDIS_HOST,
      email: !!(config.USER_MAIL && config.APP_PASSWORD),
      googleOAuth: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
      facebookOAuth: !!(config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET),
      turnstile: !!config.TURNSTILE_SECRET
    };

    logger.info('🔧 Service Configuration Status:');
    Object.entries(services).forEach(([service, enabled]) => {
      const status = enabled ? '✅' : '❌';
      logger.info(`  ${status} ${service}: ${enabled ? 'Enabled' : 'Disabled'}`);
    });

    return services;
  }
}

module.exports = ConfigValidator;
