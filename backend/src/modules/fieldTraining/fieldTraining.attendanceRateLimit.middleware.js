const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const attendanceConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لمحاولات تأكيد الحضور. حاول لاحقًا.',
    code: 'ATTENDANCE_CONFIRM_RATE_LIMIT',
  },
});

module.exports = { attendanceConfirmLimiter };
