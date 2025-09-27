const { RateLimiterRedis } = require("rate-limiter-flexible");
const redis = require("./redis.js");

const rateLimiterGeneral = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'general_limit',
    points: process.env.GENERAL_REQUEST, // Số lượng request tối đa
    duration: process.env.DEV_GENERAL_REQUEST_COOLDOWN,  // Thời gian hồi request (secs)
    blockDuration: process.env.GENERAL_REQUEST_BLOCK // Block trong vòng 60s nếu vượt quá
})
const rateLimiterAuth = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'auth_limit',
    points: process.env.AUTH_REQUEST,
    duration: process.env.DEV_AUTH_REQUEST,
    blockDuration: process.env.AUTH_REQUEST_BLOCK
})
module.exports = { rateLimiterAuth, rateLimiterGeneral };