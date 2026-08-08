const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const windowMs = env.RATE_LIMIT_WINDOW_MS;
const max = env.RATE_LIMIT_MAX;

const skipPreflight = (req) => req.method === 'OPTIONS';

/** Lightweight student polling — counted separately so SPA dashboards are not starved. */
function isAttendanceWindowActivePoll(req) {
  if (req.method !== 'GET') return false;
  const path = String(req.path || req.url || '').split('?')[0];
  return /\/student\/field-training\/attendance-window\/active\/?$/.test(path);
}

const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipPreflight(req) || isAttendanceWindowActivePoll(req),
  message: { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
});

/** Dedicated soft cap for attendance active-window polling (per IP). */
const attendancePollLimiter = rateLimit({
  windowMs,
  max: Math.max(env.ATTENDANCE_POLL_RATE_LIMIT_MAX || 240, 60),
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  message: { success: false, message: 'Too many attendance polls', code: 'ATTENDANCE_POLL_RATE_LIMIT' },
});

const authLimiter = rateLimit({
  windowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  message: { success: false, message: 'Too many authentication attempts', code: 'AUTH_RATE_LIMIT' },
});

module.exports = { apiLimiter, authLimiter, attendancePollLimiter, isAttendanceWindowActivePoll };
