const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const authRoutes = require('./modules/auth/auth.routes');
const { env } = require('./config/env');
const { prisma } = require('./config/db');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { requestIdMiddleware } = require('./middlewares/requestId.middleware');
const { createRequestLogger } = require('./middlewares/requestLogger.middleware');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(requestIdMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const corsOrigins =
  env.NODE_ENV === 'production'
    ? env.CORS_ORIGINS
    : [...new Set([...env.CORS_ORIGINS, 'http://localhost:5173', 'http://127.0.0.1:5173'])];
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : false,
    credentials: true,
    maxAge: 86400,
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(createRequestLogger());
}

app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'battechno-lms-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (req, res) => {
  if (!env.DATABASE_URL) {
    return res.status(503).json({
      status: 'not_ready',
      db: false,
      reason: 'DATABASE_URL not configured',
    });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready', db: true });
  } catch {
    return res.status(503).json({ status: 'not_ready', db: false });
  }
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', env.UPLOAD_DIR))
);

app.use('/api/auth', authLimiter, authRoutes);
app.use(`/api/${env.API_VERSION}`, apiLimiter, routes);

app.use(errorMiddleware);

module.exports = app;
