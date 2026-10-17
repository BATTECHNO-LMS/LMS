const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const authRoutes = require('./modules/auth/auth.routes');
const { env } = require('./config/env');
const { getBrowserCorsOrigins } = require('./config/corsOrigins');
const { prisma } = require('./config/db');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { requestIdMiddleware } = require('./middlewares/requestId.middleware');
const { createRequestLogger } = require('./middlewares/requestLogger.middleware');
const { createPerfTimingMiddleware } = require('./middlewares/perfTiming.middleware');
const { authenticate } = require('./middlewares/auth.middleware');
const { apiLimiter, attendancePollLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();

// Never advertise Express; Helmet also strips this, but set explicitly.
app.disable('x-powered-by');

// Never `true`: only a capped number of loopback / private proxy hops are trusted (config/trustProxy).
app.set('trust proxy', env.TRUST_PROXY_SETTING);

const allowedOrigins = getBrowserCorsOrigins();

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
  exposedHeaders: [
    'X-Request-Id',
    'Content-Disposition',
    'X-Completion-Letter-Identity',
    'X-Zip-Selected',
    'X-Zip-Included',
    'X-Zip-Missing',
    'X-Zip-Failed',
    'X-Zip-Skipped',
    'X-Zip-Unissued',
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));

app.use(requestIdMiddleware);

app.use(
  helmet({
    // API responses are JSON; browser CSP for the SPA is owned by the frontend host/Nginx.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    // nosniff / XSS filter / HSTS (when HTTPS) come from Helmet defaults.
  })
);

if (process.env.NODE_ENV !== 'test') {
  app.use(createRequestLogger());
  app.use(createPerfTimingMiddleware());
}

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'eprojecto API',
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

// Private Field Training deliverables (submissions, instruction files, completion
// letters) must never be served via auth-only static. Use the authorized
// download-url API routes instead — authenticate alone is not object ACL.
app.use('/uploads/field-training', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});
// Bulk student-report ZIPs must never be served via static /uploads — only the
// authenticated + authorized API download route may stream them.
app.use('/uploads/private', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});
app.use('/uploads/ft-student-report-exports', (_req, res) => {
  res.status(404).json({ message: 'Not found' });
});
app.use(
  '/uploads',
  authenticate,
  express.static(path.join(__dirname, '..', env.UPLOAD_DIR))
);

app.use('/api/auth', authRoutes);
app.use(`/api/${env.API_VERSION}/auth`, authRoutes);
// Per-client buckets (verified user id, else real client IP). Auth routes carry their own
// credential / OTP limiters and are matched above, before this one.
const apiRateLimiters = env.API_RATE_LIMIT_ENABLED ? [apiLimiter, attendancePollLimiter] : [];
app.use(`/api/${env.API_VERSION}`, ...apiRateLimiters, routes);

app.use(errorMiddleware);

module.exports = app;
