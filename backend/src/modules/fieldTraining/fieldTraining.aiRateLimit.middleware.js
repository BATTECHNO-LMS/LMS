const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../../config/env');

const aiSelfEvalLimiter = rateLimit({
  windowMs: Number(env.FIELD_TRAINING_AI_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.FIELD_TRAINING_AI_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لطلبات التحليل بالذكاء الاصطناعي. حاول لاحقًا.',
    code: 'AI_RATE_LIMIT',
  },
});

module.exports = { aiSelfEvalLimiter };
