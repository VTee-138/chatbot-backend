/**
 * Auto-setup environment if .env is missing
 * This runs automatically when server starts
 */

const fs = require('fs');
const path = require('path');

const setupEnvironment = () => {
    const envPath = path.join(process.cwd(), '.env');
    
    // Check if .env exists
    if (!fs.existsSync(envPath)) {
        console.log('⚠️  .env file not found, creating basic .env...');
        
        const basicEnv = `# Auto-generated basic .env file
# Please update with your actual credentials

NODE_ENV=development
PORT=8000

# Database (Update this!)
DATABASE_URL="postgresql://username:password@localhost:5432/chatbot_db?schema=public"

# JWT Secrets (Update these in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars-here
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production-min-32-chars-here
JWT_VALIDATE_SECRET=your-validate-secret-change-in-production
JWT_2FA_SECRET=your-2fa-secret-change-in-production

# JWT Expiration Times
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_VALIDATE_EXPIRES_IN=2m
JWT_2FA_EXPIRES_IN=5m

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=
REDIS_STORE_SECRET=your-redis-store-secret

# Email Configuration (REQUIRED for email features)
# Get these from Gmail App Password setup
USER_MAIL=
APP_PASSWORD=

# Frontend URL for email verification links
URL_MAIL_PUBLIC=http://localhost:3000

# CAPTCHA (REQUIRED for security)
TURNSTILE_SECRET=

# Google OAuth (Optional - for SSO)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Facebook OAuth (Optional - for SSO)  
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# OAuth URLs
BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=12

# API Configuration
API_VERSION=v1
API_PREFIX=/api

# CORS
CORS_ORIGIN=*

# Pagination
DEFAULT_PAGE_SIZE=20
MAX_PAGE_SIZE=100
`;

        try {
            fs.writeFileSync(envPath, basicEnv);
            console.log('✅ Created basic .env file');
            console.log('📝 Please update the following required variables:');
            console.log('   - DATABASE_URL (your PostgreSQL connection)');
            console.log('   - USER_MAIL (your Gmail address)');
            console.log('   - APP_PASSWORD (Gmail App Password)');
            console.log('   - TURNSTILE_SECRET (Cloudflare CAPTCHA key)');
            console.log('');
            console.log('🔧 After updating .env, restart the server');
        } catch (error) {
            console.error('❌ Failed to create .env file:', error.message);
        }
    }
    
    // Load environment variables
    require('dotenv').config();
    
    // Check critical variables
    const missingVars = [];
    const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET', 
        'TURNSTILE_SECRET'
    ];
    
    const recommendedVars = [
        'USER_MAIL',
        'APP_PASSWORD'
    ];
    
    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });
    
    if (missingVars.length > 0) {
        console.log('⚠️  Missing required environment variables:');
        missingVars.forEach(varName => {
            console.log(`   ❌ ${varName}`);
        });
    }
    
    const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
    if (missingRecommended.length > 0) {
        console.log('📧 Missing email configuration (will use mock mail):');
        missingRecommended.forEach(varName => {
            console.log(`   ⚠️  ${varName}`);
        });
        console.log('   💡 Email features will work with mock service in development');
    }
};

module.exports = { setupEnvironment };