const { createRateLimiter, userOrIpKey } = require('../../middlewares/rateLimit.middleware');

const attendanceConfirmLimiter = createRateLimiter({
  name: 'attendance_confirm',
  routeGroup: 'student_field_training_attendance',
  keyType: 'user_or_ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لمحاولات تأكيد الحضور. حاول لاحقًا.',
    code: 'ATTENDANCE_CONFIRM_RATE_LIMIT',
  },
});

module.exports = { attendanceConfirmLimiter };
