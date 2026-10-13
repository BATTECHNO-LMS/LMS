'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../../config/env');

const windowMs = Number(env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const max = Number(env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_MAX) || 90;

/**
 * Endpoint-aware cap for watch heartbeats / player events.
 * Normal playback is ~6 requests/min per tab; two tabs plus seeks stay under 90/min.
 * Does not change the platform-wide limiter.
 */
const recordedLectureHeartbeatLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.userId || ipKeyGenerator(req.ip || '');
    const lectureId = req.params?.lectureId || 'unknown';
    return `${userId}:${lectureId}`;
  },
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لنبضات تتبع المشاهدة. حاول لاحقًا.',
    code: 'RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT',
  },
});

module.exports = { recordedLectureHeartbeatLimiter };
