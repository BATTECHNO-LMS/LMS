const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const windowMs = env.RATE_LIMIT_WINDOW_MS;
const max = env.RATE_LIMIT_MAX;

const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts', code: 'AUTH_RATE_LIMIT' },
});

module.exports = { apiLimiter, authLimiter };
