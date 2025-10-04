const express = require('express');
const router = express.Router();
const cookieHelper = require('../utils/cookieHelper');
const { successResponse } = require('../utils/response');

/**
 * @route   GET /api/v1/debug/cookies
 * @desc    Debug cookie configuration and test cookie functionality
 * @access  Public (for debugging)
 */
router.get('/cookies', (req, res) => {
  try {
    // Validate configuration
    const validation = cookieHelper.validateConfiguration();
    
    // Test cookie functionality  
    const testResults = cookieHelper.testCookies(req, res);
    
    // Get current cookies from request
    const currentCookies = req.cookies || {};
    
    // Get debug info
    const debugInfo = cookieHelper.getDebugInfo();
    
    const responseData = {
      validation,
      testResults,
      currentCookies: Object.keys(currentCookies).reduce((acc, key) => {
        acc[key] = currentCookies[key] ? 'HAS_VALUE' : 'EMPTY';
        return acc;
      }, {}),
      debugInfo,
      headers: {
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']?.substring(0, 100) + '...',
        cookie: req.headers.cookie ? 'PRESENT' : 'NOT_SENT',
        referer: req.headers.referer
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
    
    return successResponse(res, responseData, 'Cookie debug information');
    
  } catch (error) {
    console.error('Cookie debug error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to debug cookies',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/debug/cookies/test-auth
 * @desc    Test authentication cookie setting
 * @access  Public (for debugging)
 */
router.post('/test-auth', (req, res) => {
  try {
    // Mock auth tokens for testing
    const mockTokens = {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      csrfToken: 'mock_csrf_' + Date.now()
    };
    
    const mockClientInfo = {
      id: 'test_user_id',
      email: 'test@example.com',
      userName: 'testuser',
      role: 'USER',
      ssoProviders: []
    };
    
    // Set auth cookies using cookieHelper
    cookieHelper.setAuthCookies(res, mockTokens, mockClientInfo);
    
    return successResponse(res, {
      message: 'Test authentication cookies set successfully',
      tokensSet: Object.keys(mockTokens),
      clientInfo: 'SET',
      cookieOptions: cookieHelper.getCookieOptions(),
      instructions: {
        next: 'Check browser DevTools > Application > Cookies to verify cookies were set',
        verify: 'Call GET /api/v1/debug/cookies to verify cookies are readable'
      }
    }, 'Test auth cookies set');
    
  } catch (error) {
    console.error('Test auth cookies error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set test cookies',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/v1/debug/cookies/clear
 * @desc    Clear all authentication cookies
 * @access  Public (for debugging)
 */
router.post('/clear', (req, res) => {
  try {
    cookieHelper.clearAuthCookies(res);
    
    return successResponse(res, {
      message: 'All authentication cookies cleared',
      cookiesCleared: ['accessToken', 'refreshToken', 'clientInformation', 'XSRF-TOKEN'],
      cookieOptions: cookieHelper.getCookieOptions()
    }, 'Cookies cleared successfully');
    
  } catch (error) {
    console.error('Clear cookies error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cookies',
      error: error.message
    });
  }
});

module.exports = router;