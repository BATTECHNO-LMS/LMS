const { env } = require('../../config/env');
const { createRateLimiter, userOrIpKey } = require('../../middlewares/rateLimit.middleware');

const aiSelfEvalLimiter = createRateLimiter({
  name: 'field_training_ai_self_eval',
  routeGroup: 'student_field_training',
  keyType: 'user_or_ip',
  windowMs: Number(env.FIELD_TRAINING_AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.FIELD_TRAINING_AI_RATE_LIMIT_MAX) || 10,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لطلبات التحليل بالذكاء الاصطناعي. حاول لاحقًا.',
    code: 'AI_RATE_LIMIT',
  },
});

module.exports = { aiSelfEvalLimiter };
