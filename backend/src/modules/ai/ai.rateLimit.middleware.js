const { env } = require('../../config/env');
const { createRateLimiter, userOrIpKey } = require('../../middlewares/rateLimit.middleware');

const aiGenerateLimiter = createRateLimiter({
  name: 'ai_generate',
  routeGroup: 'ai',
  keyType: 'user_or_ip',
  windowMs: Number(env.AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.AI_RATE_LIMIT_MAX) || 20,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح مؤقتًا. يرجى المحاولة لاحقًا.',
    code: 'AI_RATE_LIMIT',
  },
});

module.exports = { aiGenerateLimiter };
