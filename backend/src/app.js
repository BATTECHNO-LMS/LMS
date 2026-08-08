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

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  'https://lms.battechno.com',
  'https://www.lms.battechno.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  ...env.CORS_ORIGINS,
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

app.use(requestIdMiddleware);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(createRequestLogger());
}

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'BATTECHNO-LMS API',
    status: 'running',
  });
});

/** Liveness: process can serve HTTP. Does not require DATABASE_URL or a live DB. */
app.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'battechno-lms-api',
    timestamp: new Date().toISOString(),
  });
});

/** Readiness: PostgreSQL must be configured and reachable. */
app.get('/health/ready', async (req, res) => {
  if (!env.DATABASE_URL) {
    return res.status(503).json({
      status: 'not_ready',
      database: 'unconfigured',
      db: false,
      reason: 'DATABASE_URL not configured',
    });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ status: 'ready', database: 'connected', db: true });
  } catch {
    return res.status(503).json({ status: 'not_ready', database: 'disconnected', db: false });
  }
});

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', env.UPLOAD_DIR))
);

app.use('/api/auth', authRoutes);
app.use(`/api/${env.API_VERSION}`, routes);

app.use(errorMiddleware);

module.exports = app;
