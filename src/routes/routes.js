const express = require('express');
const authRoutes = require('./auth');
const organizationRoutes = require('./organizations');
const apiKeyRoutes = require('./apiKeys');
const { successResponse } = require('../utils/response');
const zaloRouter = require('./zaloRouter');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Check API health and system status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: OK
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         uptime:
 *                           type: number
 *                           description: Server uptime in seconds
 *                         version:
 *                           type: string
 *                           example: "1.0.0"
 *                         environment:
 *                           type: string
 *                           example: development
 *                         database:
 *                           type: string
 *                           example: Connected
 */
// Health check endpoint
router.get('/health', (req, res) => {
  return successResponse(res, {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected', // You could add actual DB health check here
  }, 'Service is healthy');
});

// API routes
router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/zalo', zaloRouter)
module.exports = router;
