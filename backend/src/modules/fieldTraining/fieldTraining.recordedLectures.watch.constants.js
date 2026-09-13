'use strict';

const { env } = require('../../config/env');

const DEFAULT_COMPLETION_THRESHOLD_PERCENT = 90;
const HEARTBEAT_INTERVAL_SECONDS = 10;
const MAX_PLAYBACK_RATE = 2.5;
const MAX_HEARTBEAT_SPAN_SECONDS = Math.ceil(HEARTBEAT_INTERVAL_SECONDS * MAX_PLAYBACK_RATE) + 3;
const SEGMENT_GAP_TOLERANCE_SECONDS = 2;
const DURATION_BOUNDS_TOLERANCE_SECONDS = 2;
const RESUME_NEAR_END_SECONDS = 10;
const MAX_SESSION_CURSORS = 30;
const MAX_POSITION_WITHOUT_DURATION = 24 * 3600;
const WATCH_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});
const PLAYER_STATES = Object.freeze({
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  BUFFERING: 'BUFFERING',
  ENDED: 'ENDED',
  SEEKING: 'SEEKING',
  CUED: 'CUED',
  UNSTARTED: 'UNSTARTED',
});

function getCompletionThresholdPercent() {
  const n = Number(env.RECORDED_LECTURE_COMPLETION_PERCENT);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return DEFAULT_COMPLETION_THRESHOLD_PERCENT;
  return n;
}

const WATCH_MSG = Object.freeze({
  heartbeatInvalid: 'بيانات تتبع المشاهدة غير صالحة.',
  heartbeatSpanTooLarge: 'مدة نبضة المشاهدة أكبر من المسموح.',
  heartbeatOutOfRange: 'موضع المشاهدة خارج مدة المحاضرة.',
  sessionRequired: 'معرّف جلسة المشاهدة مطلوب.',
  sequenceInvalid: 'رقم تسلسل نبضة المشاهدة غير صالح.',
  playerStateInvalid: 'حالة المشغّل غير معروفة.',
  providerUnsupported: 'مشغّل هذا المزود غير متاح بعد.',
});

module.exports = {
  DEFAULT_COMPLETION_THRESHOLD_PERCENT,
  HEARTBEAT_INTERVAL_SECONDS,
  MAX_PLAYBACK_RATE,
  MAX_HEARTBEAT_SPAN_SECONDS,
  SEGMENT_GAP_TOLERANCE_SECONDS,
  DURATION_BOUNDS_TOLERANCE_SECONDS,
  RESUME_NEAR_END_SECONDS,
  MAX_SESSION_CURSORS,
  MAX_POSITION_WITHOUT_DURATION,
  WATCH_STATUSES,
  PLAYER_STATES,
  WATCH_MSG,
  getCompletionThresholdPercent,
};
