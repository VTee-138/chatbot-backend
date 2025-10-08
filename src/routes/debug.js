const express = require('express');
const router = express.Router();
const cookieHelper = require('../utils/cookieHelper');
const { successResponse, errorResponse } = require('../utils/response');
const { verifyToken, decodePayload } = require('../utils/jwt');
const jwt = require('jsonwebtoken');

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

/**
 * @route   POST /api/v1/debug/verify-token
 * @desc    Debug token verification - check if token is valid
 * @access  Public (for debugging)
 */
router.post('/verify-token', (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return errorResponse(res, 'Token is required in request body', 400);
    }
    
    // Decode without verification to see payload
    const decodedPayload = jwt.decode(token, { complete: true });
    
    if (!decodedPayload) {
      return errorResponse(res, 'Invalid token format - cannot decode', 400);
    }
    
    const results = {
      tokenPreview: token.substring(0, 30) + '...',
      header: decodedPayload.header,
      payload: decodedPayload.payload,
      verificationResults: {}
    };
    
    // Try to verify with different token types
    const tokenTypes = ['access', 'refresh', '2fa', 'validate'];
    
    for (const type of tokenTypes) {
      try {
        const verified = verifyToken(token, type);
        results.verificationResults[type] = {
          success: true,
          message: `✅ Valid ${type} token`,
          data: verified
        };
      } catch (error) {
        results.verificationResults[type] = {
          success: false,
          error: error.name,
          message: error.message
        };
      }
    }
    
    // Determine which type succeeded
    const successfulType = Object.keys(results.verificationResults).find(
      type => results.verificationResults[type].success
    );
    
    return successResponse(res, {
      ...results,
      conclusion: successfulType 
        ? `Token is a valid ${successfulType.toUpperCase()} token`
        : 'Token is INVALID for all token types',
      recommendation: !successfulType 
        ? 'Check JWT_SECRET configuration or token may be from different environment'
        : `Use this token as ${successfulType} token type`
    }, 'Token verification debug completed');
    
  } catch (error) {
    console.error('Token verification debug error:', error);
    return errorResponse(res, 'Failed to verify token: ' + error.message, 500);
  }
});

module.exports = router;