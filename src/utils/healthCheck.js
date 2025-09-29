const { transporter } = require('../config/mail');
const config = require('../config');

class HealthCheck {
  static async checkMailService() {
    try {
      if (config.NODE_ENV === 'development') {
        console.log('📧 Development mode - using mock mail service');
        return { status: 'healthy', service: 'mock' };
      }
      
      const isHealthy = await transporter.verify();
      console.log('📧 Mail service status:', isHealthy ? '✅ Healthy' : '❌ Unhealthy');
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'smtp',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('📧 Mail service health check failed:', error.message);
      return {
        status: 'error',
        service: 'smtp',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  static async checkDatabase() {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // Simple query to check DB connection
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      
      console.log('🗄️ Database status: ✅ Healthy');
      return {
        status: 'healthy',
        service: 'database',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('🗄️ Database health check failed:', error.message);
      return {
        status: 'error',
        service: 'database',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  static async checkRedis() {
    try {
      const redis = require('../config/redis');
      
      // Simple ping to Redis
      const pong = await redis.ping();
      const isHealthy = pong === 'PONG';
      
      console.log('🔴 Redis status:', isHealthy ? '✅ Healthy' : '❌ Unhealthy');
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        service: 'redis',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('🔴 Redis health check failed:', error.message);
      return {
        status: 'error',
        service: 'redis',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  static async checkAll() {
    console.log('🔍 Running health checks...\n');
    
    const results = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMailService()
    ]);

    const healthReport = {
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      services: {
        database: results[0].status === 'fulfilled' ? results[0].value : { status: 'error', error: results[0].reason?.message },
        redis: results[1].status === 'fulfilled' ? results[1].value : { status: 'error', error: results[1].reason?.message },
        mail: results[2].status === 'fulfilled' ? results[2].value : { status: 'error', error: results[2].reason?.message }
      }
    };

    const healthyServices = Object.values(healthReport.services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(healthReport.services).length;
    
    console.log(`\n📊 Health Summary: ${healthyServices}/${totalServices} services healthy`);
    
    return healthReport;
  }
}

module.exports = HealthCheck;