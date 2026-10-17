const { env } = require('../../config/env');
const { createRateLimiter, userOrIpKey } = require('../../middlewares/rateLimit.middleware');

const fileUploadLimiter = createRateLimiter({
  name: 'file_upload',
  routeGroup: 'files',
  keyType: 'user_or_ip',
  windowMs: Number(env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(env.FILE_UPLOAD_RATE_LIMIT_MAX) || 30,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لطلبات الرفع. حاول لاحقًا.',
    code: 'FILE_UPLOAD_RATE_LIMIT',
  },
});

module.exports = { fileUploadLimiter };
