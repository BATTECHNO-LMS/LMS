'use strict';

const { env } = require('../../config/env');
const { createRateLimiter, userOrIpKey } = require('../../middlewares/rateLimit.middleware');

const windowMs = Number(env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const max = Number(env.RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT_MAX) || 90;

/**
 * Endpoint-aware cap for watch heartbeats / player events.
 * Normal playback is ~6 requests/min per tab; two tabs plus seeks stay under 90/min.
 * Does not change the platform-wide limiter.
 */
const recordedLectureHeartbeatLimiter = createRateLimiter({
  name: 'recorded_lecture_heartbeat',
  routeGroup: 'field_training_recorded_lectures',
  keyType: 'user_or_ip_resource',
  windowMs,
  max,
  keyGenerator: (req) => {
    const lectureId = String(req.params?.lectureId || 'unknown').slice(0, 64);
    return `${userOrIpKey(req)}:${lectureId}`;
  },
  message: {
    success: false,
    message: 'تجاوزت الحد المسموح لنبضات تتبع المشاهدة. حاول لاحقًا.',
    code: 'RECORDED_LECTURE_HEARTBEAT_RATE_LIMIT',
  },
});

module.exports = { recordedLectureHeartbeatLimiter };
