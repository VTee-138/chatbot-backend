const config = require('../config');

/**
 * Verify Turnstile CAPTCHA token with Cloudflare
 * @param {string} token - The Turnstile token from frontend
 * @param {string} remoteip - The user's IP address (optional)
 * @returns {Promise<boolean>} - Returns true if verification is successful
 */
const verifyTurnstileToken = async (token, remoteip = null) => {
  try {
    // Validate input
    if (!token || typeof token !== 'string') {
      console.error('Invalid Turnstile token provided');
      return false;
    }

    if (!config.TURNSTILE_SECRET) {
      console.error('TURNSTILE_SECRET is not configured');
      return false;
    }

    const formData = new URLSearchParams();
    formData.append('secret', config.TURNSTILE_SECRET);
    formData.append('response', token);
    
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('Turnstile verification request failed:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('Turnstile verification successful');
      return true;
    } else {
      console.error('Turnstile verification failed:', result['error-codes']);
      return false;
    }
  } catch (error) {
    console.error('Error verifying Turnstile token:', error);
    return false;
  }
};

module.exports = {
  verifyTurnstileToken,
};