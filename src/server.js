const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require("path");
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { checkRedis } = require('./utils/checkConfiguration')
const config = require('./config');
const http = require("http");
const { Server } = require('socket.io');
const { notFound, requestLogger } = require('./middleware');
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');
const router = require('./routes/index');
const { generalLimiter } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const webhookRoutes = require('./webhooks');
const { initSocket } = require('./config/socket');


const app = express();
app.use(express.static(path.join(__dirname, "../public")))
// Rate limiting
// app.use(generalLimiter)
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
// Patch để connect-redis dùng setex với ioredis
// RedisStore.prototype.set = function (sid, sess, fn) {
//   const ttl = this.ttl || 86400; // TTL mặc định 1 ngày
//   const key = this.prefix + sid;

//   let value;
//   try {
//     value = JSON.stringify(sess);
//   } catch (er) {
//     return fn(er);
//   }

//   this.client.setex(key, ttl, value, fn);
// }
// Trust proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// // CORS configuration
// app.use(cors({
//   origin: config.CORS_ORIGIN,
//   credentials: true,
//   optionsSuccessStatus: 200,
// }));
const allowedOrigins = ["https://heki.aipencil.ai"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || !allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));


// // Saving session in Redis for performance improvement
// app.use(session({
//   store: new RedisStore({
//     client: redis,
//     prefix: "sess:",
//     ttl: 60 * 60 * 24,
//     disableTTL: false // Đảm bảo vẫn set expire
//   }),
//   secret: config.REDIS_STORE_SECRET,
//   resave: false,
//   saveUninitialized: false, // session chỉ được tạo khi bạn bắt đầu modify nó
//   rolling: true, // Mỗi khi người dùng thực hiện bắt kì activity nào với API, thì session sẽ tự động tái tạo session mới
//   cookie: {
//     secure: false, // Chỉ bật khi lên môi trường production
//     httpOnly: true,
//     sameSite: 'lax',
//     maxAge: 24 * 60 * 60 * 1000 // 1 ngày

//   }
// }))

// Logging
// if (config.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// } else {
//   app.use(morgan('combined'));
// }

// Custom request logger
// app.use(requestLogger);
// API Documentation with Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// API routes
app.use(`/api/v1`, router);
app.use('/webhooks', webhookRoutes);
// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI Chatbot SaaS API',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    documentation: `http://localhost:${config.PORT}/api-docs`,
    endpoints: {
      auth: `${config.API_PREFIX}/${config.API_VERSION}/auth`,
      organizations: `${config.API_PREFIX}/${config.API_VERSION}/organizations`,
      apiKeys: `${config.API_PREFIX}/${config.API_VERSION}/api-keys`,
    },
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server)
// Start server
const startServer = async () => {
  try {
    // Test database connection
    const prisma = require('./config/database');
    const { checkNodeMailer } = require('./utils/checkConfiguration')
    await prisma.$connect();
    console.log("✅ Database connected successfully");
    checkRedis();
    checkNodeMailer();
    server.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log(`📍 Environment: ${config.NODE_ENV}`);
      console.log(
        `🔗 API URL: http://localhost:${config.PORT}${config.API_PREFIX}/${config.API_VERSION}`
      );
      console.log(
        `📖 Health check: http://localhost:${config.PORT}${config.API_PREFIX}/${config.API_VERSION}/health`
      );
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        console.log("✅ HTTP server closed");
        await prisma.$disconnect();
        console.log("✅ Database connection closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;
