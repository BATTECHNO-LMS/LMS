const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../../config/env');

const fileUploadLimiter = rateLimit({
  windowMs: Number(env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.FILE_UPLOAD_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لطلبات الرفع. حاول لاحقًا.',
    code: 'FILE_UPLOAD_RATE_LIMIT',
  },
});

module.exports = { fileUploadLimiter };
