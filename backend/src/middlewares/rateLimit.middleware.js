const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
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

/** Credential-attempt key: real client IP (trust proxy) + normalized identifier. */
function credentialAttemptKey(req) {
  const ip = ipKeyGenerator(req.ip || '');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
  return `${ip}|${email}`;
}

/**
 * Login / forgot-password brute-force cap. Keyed per client + identifier so one client
 * cannot hammer an account and one shared NAT cannot lock out every other user.
 */
const credentialAttemptLimiter = rateLimit({
  windowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  keyGenerator: credentialAttemptKey,
  message: {
    success: false,
    message: 'تم تجاوز عدد المحاولات المسموح. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى.',
    code: 'AUTH_RATE_LIMIT',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  attendancePollLimiter,
  credentialAttemptLimiter,
  credentialAttemptKey,
  isAttendanceWindowActivePoll,
};
