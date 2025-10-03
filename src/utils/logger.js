/**
 * Logger utility for backend
 * Centralized logging with different levels
 */

const config = require('../config');

class Logger {
  constructor() {
    this.isDevelopment = config.NODE_ENV === 'development';
  }

  /**
   * Log general information (development only)
   */
  log(...args) {
    if (this.isDevelopment) {
      console.log(...args);
    }
  }

  /**
   * Log informational messages (development only)
   */
  info(...args) {
    if (this.isDevelopment) {
      console.info(...args);
    }
  }

  /**
   * Log warnings (always logged - important for production)
   */
  warn(...args) {
    console.warn(...args);
  }

  /**
   * Log errors (always logged - critical for production)
   */
  error(...args) {
    console.error(...args);
  }

  /**
   * Log debug messages (development only)
   */
  debug(...args) {
    if (this.isDevelopment) {
      console.debug(...args);
    }
  }

  /**
   * Force log regardless of environment (use sparingly)
   */
  forceLog(...args) {
    console.log(...args);
  }

  /**
   * Log with timestamp
   */
  logWithTimestamp(...args) {
    const timestamp = new Date().toISOString();
    if (this.isDevelopment) {
      console.log(`[${timestamp}]`, ...args);
    }
  }

  /**
   * Log HTTP request (development only)
   */
  logRequest(method, path, statusCode) {
    if (this.isDevelopment) {
      console.log(`${method} ${path} - ${statusCode}`);
    }
  }
}

module.exports = new Logger();
