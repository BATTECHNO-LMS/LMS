const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../../config/env');

const aiGenerateLimiter = rateLimit({
  windowMs: Number(env.AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.AI_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح مؤقتًا. يرجى المحاولة لاحقًا.',
    code: 'AI_RATE_LIMIT',
  },
});

module.exports = { aiGenerateLimiter };
