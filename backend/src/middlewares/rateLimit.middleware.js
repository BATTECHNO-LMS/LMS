const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const { clientIpRateLimitKey } = require('../shared/security/clientIdentity');
const { recordSecurityEvent } = require('../shared/security/securityEvents');

const windowMs = env.RATE_LIMIT_WINDOW_MS;
const max = env.RATE_LIMIT_MAX;

const skipPreflight = (req) => req.method === 'OPTIONS';

/** Lightweight student polling — counted separately so SPA dashboards are not starved. */
function isAttendanceWindowActivePoll(req) {
  if (req.method !== 'GET') return false;
  const path = String(req.path || req.url || '').split('?')[0];
  return /\/student\/field-training\/attendance-window\/active\/?$/.test(path);
}

/**
 * Authenticated caller id without touching the database: `req.user` when auth already ran,
 * otherwise a cryptographically verified Bearer JWT. A forged/expired token yields null, so
 * an attacker cannot mint fresh buckets by inventing user ids.
 */
function verifiedUserId(req) {
  if (req.user?.userId) return req.user.userId;
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  try {
    const payload = verifyToken(header.slice(7).trim());
    return typeof payload?.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}

/** One bucket per signed-in user (a campus NAT must not share one bucket), else per client IP. */
function userOrIpKey(req) {
  const userId = verifiedUserId(req);
  return userId ? `user:${userId}` : `ip:${clientIpRateLimitKey(req)}`;
}

function normalizedIdentifier(req) {
  const raw = req.body?.email;
  return typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
}

/** One-way, truncated identifier fingerprint for security metadata (never the raw email). */
function identifierHash(identifier) {
  if (!identifier) return null;
  return crypto.createHash('sha256').update(identifier).digest('hex').slice(0, 24);
}

/** Credential-attempt key: real client IP (trusted proxy chain) + normalized identifier. */
function credentialAttemptKey(req) {
  return `${clientIpRateLimitKey(req)}|${normalizedIdentifier(req)}`;
}

/**
 * express-rate-limit with a security event on block. Exactly one RATE_LIMIT_TRIGGERED row
 * per limiter bucket per window (permitted requests are never recorded). The 429 is sent
 * regardless of whether the event write succeeds.
 *
 * @param {{
 *   name: string, routeGroup: string, windowMs: number, max: number,
 *   keyGenerator: (req: import('express').Request) => string,
 *   keyType: 'user_or_ip' | 'ip_identifier' | 'user_or_ip_resource',
 *   skip?: (req: import('express').Request) => boolean,
 *   message: { success: false, message: string, code: string },
 *   withIdentifier?: boolean,
 * }} opts
 */
function createRateLimiter(opts) {
  const limiterWindowMs = Math.max(1000, Number(opts.windowMs) || 60_000);
  return rateLimit({
    windowMs: limiterWindowMs,
    limit: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: opts.skip || skipPreflight,
    keyGenerator: opts.keyGenerator,
    handler(req, res, _next, options) {
      const key = String(opts.keyGenerator(req));
      const userId = verifiedUserId(req);
      recordSecurityEvent({
        eventType: opts.eventType || 'RATE_LIMIT_TRIGGERED',
        outcome: 'BLOCKED',
        req,
        userId: userId || null,
        entityType: 'rate_limiter',
        reason: opts.name,
        metadata: {
          limiter: opts.name,
          routeGroup: opts.routeGroup,
          keyType: opts.keyType,
          limit: opts.max,
          windowSeconds: Math.round(limiterWindowMs / 1000),
          identifierHash: opts.withIdentifier ? identifierHash(normalizedIdentifier(req)) || undefined : undefined,
        },
        dedupeKey: `${opts.name}|${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}`,
        dedupeWindowMs: limiterWindowMs,
      });
      res.status(options.statusCode).json(opts.message);
    },
  });
}

/** Platform-wide per-client limiter for /api/v1 (mounted in app.js). */
const apiLimiter = createRateLimiter({
  name: 'api_general',
  routeGroup: 'api',
  windowMs,
  max,
  keyGenerator: userOrIpKey,
  keyType: 'user_or_ip',
  skip: (req) => skipPreflight(req) || isAttendanceWindowActivePoll(req),
  message: { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
});

/** Dedicated soft cap for attendance active-window polling (only counts those polls). */
const attendancePollLimiter = createRateLimiter({
  name: 'attendance_poll',
  routeGroup: 'student_field_training_attendance',
  windowMs,
  max: Math.max(env.ATTENDANCE_POLL_RATE_LIMIT_MAX || 240, 60),
  keyGenerator: userOrIpKey,
  keyType: 'user_or_ip',
  skip: (req) => skipPreflight(req) || !isAttendanceWindowActivePoll(req),
  message: { success: false, message: 'Too many attendance polls', code: 'ATTENDANCE_POLL_RATE_LIMIT' },
});

const CREDENTIAL_LIMIT_MESSAGE = {
  success: false,
  message: 'تم تجاوز عدد المحاولات المسموح. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى.',
  code: 'AUTH_RATE_LIMIT',
};

/**
 * Login / forgot-password brute-force cap. Keyed per client + identifier so one client
 * cannot hammer an account and one shared NAT cannot lock out every other user.
 */
const credentialAttemptLimiter = createRateLimiter({
  name: 'auth_credentials',
  routeGroup: 'auth',
  windowMs,
  max: env.AUTH_RATE_LIMIT_MAX,
  keyGenerator: credentialAttemptKey,
  keyType: 'ip_identifier',
  withIdentifier: true,
  message: CREDENTIAL_LIMIT_MESSAGE,
});

/** Email-verification / password-reset OTP verify + resend + reset-password. */
const otpAttemptLimiter = createRateLimiter({
  name: 'otp_attempts',
  routeGroup: 'auth_otp',
  windowMs,
  max: env.OTP_RATE_LIMIT_MAX,
  keyGenerator: credentialAttemptKey,
  keyType: 'ip_identifier',
  withIdentifier: true,
  message: CREDENTIAL_LIMIT_MESSAGE,
});

/**
 * MFA code submissions (challenge verify, enrollment verify, step-up, recovery-code
 * regeneration, disable). Per user once authenticated, otherwise per client IP. Works with
 * the per-challenge attempt cap and the per-user factor cooldown in mfa.service.
 */
const mfaAttemptLimiter = createRateLimiter({
  name: 'mfa_attempts',
  routeGroup: 'auth_mfa',
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKey,
  keyType: 'user_or_ip',
  eventType: 'MFA_RATE_LIMIT_TRIGGERED',
  message: {
    success: false,
    message: 'تم إيقاف محاولات التحقق مؤقتًا بسبب كثرة المحاولات. يرجى المحاولة لاحقًا.',
    code: 'MFA_TEMPORARILY_LOCKED',
  },
});

module.exports = {
  createRateLimiter,
  apiLimiter,
  attendancePollLimiter,
  credentialAttemptLimiter,
  otpAttemptLimiter,
  mfaAttemptLimiter,
  credentialAttemptKey,
  userOrIpKey,
  verifiedUserId,
  identifierHash,
  normalizedIdentifier,
  isAttendanceWindowActivePoll,
  CREDENTIAL_LIMIT_MESSAGE,
};
