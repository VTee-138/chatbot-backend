const express = require('express');
const router = express.Router();
const HealthCheck = require('../utils/healthCheck');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: System health check
 *     description: Check the health status of all system components
 *     responses:
 *       200:
 *         description: Health check results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                     environment:
 *                       type: string
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                         redis:
 *                           type: object
 *                         mail:
 *                           type: object
 */
router.get('/health', async (req, res) => {
  try {
    const healthReport = await HealthCheck.checkAll();
    
    // Determine overall health status
    const services = Object.values(healthReport.services);
    const allHealthy = services.every(service => service.status === 'healthy');
    const anyUnhealthy = services.some(service => service.status === 'unhealthy');
    
    let status = 200;
    let message = 'All services are healthy';
    
    if (!allHealthy) {
      if (anyUnhealthy) {
        status = 503; // Service Unavailable
        message = 'Some services are unhealthy';
      } else {
        status = 207; // Multi-Status
        message = 'Some services have errors but system is operational';
      }
    }
    
    return res.status(status).json({
      success: allHealthy,
      message,
      data: healthReport
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return errorResponse(res, 'Health check failed', 500, error);
  }
});

/**
 * @swagger
 * /api/health/mail:
 *   get:
 *     tags: [Health]
 *     summary: Mail service health check
 *     description: Check the health status of the mail service specifically
 *     responses:
 *       200:
 *         description: Mail service health status
 */
router.get('/health/mail', async (req, res) => {
  try {
    const mailHealth = await HealthCheck.checkMailService();
    const isHealthy = mailHealth.status === 'healthy';
    
    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      message: isHealthy ? 'Mail service is healthy' : 'Mail service is unhealthy',
      data: mailHealth
    });
  } catch (error) {
    console.error('Mail health check failed:', error);
    return errorResponse(res, 'Mail health check failed', 500, error);
  }
});

module.exports = router;