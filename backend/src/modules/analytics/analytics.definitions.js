'use strict';

/**
 * Central Analytics & KPIs metric definitions.
 * Components must not invent alternative meanings.
 *
 * Online users: server-backed presence within PRESENCE_WINDOW_SECONDS.
 *   Source: auth_sessions (NOT implemented in this schema). Never infer from users.last_login_at.
 *
 * Active users: distinct users with a meaningful audit_logs action in the selected period.
 *   Automatic polling, SSE, heartbeats, and analytics refetches are not meaningful activity
 *   and are not written to audit_logs by this feature.
 *
 * New users: users.created_at within the selected period (scoped).
 *
 * Certificates issued: certificates.status = issued (micro-credentials) and/or
 *   training_certificates.status = ISSUED. Field Training completion letters are separate.
 *
 * Recorded lectures published: field_training_recorded_lectures.status = published.
 *
 * Training eligible: stored official eligibility
 *   (eligibility_reason.details.approvedEvaluationResult.approvedStatus overlay, else
 *   completion_eligibility_status). Never recomputes scoring/eligibility engines.
 *
 * Field Training scores: field_training_final_evaluations.is_current = true (approved snapshots).
 * Attendance: field_training_attendance — present + late + excused = attended;
 *   absent / unconfirmed are not treated as absent unless recorded as absent.
 * PRE vs POST: submitted field_training_assessment_attempts; PRE is diagnostic only.
 * Recorded lecture unique watch: unique_watched_seconds (union of segments), not playback seconds.
 * Timezone: Asia/Amman for period grouping/display. Instants stored UTC.
 */

const ANALYTICS_TIMEZONE = 'Asia/Amman';

/** Suggested default for auth_sessions.lastSeenAt when that table exists. */
const PRESENCE_WINDOW_SECONDS = 120;

const MAX_CUSTOM_RANGE_DAYS = 366;

const PERIODS = Object.freeze({
  TODAY: 'today',
  D7: '7d',
  D30: '30d',
  CUSTOM: 'custom',
});

const ORGANIZATION_TYPES = Object.freeze({
  UNIVERSITY: 'UNIVERSITY',
  INSTITUTION: 'INSTITUTION',
});

const FRESHNESS = Object.freeze({
  LIVE: { class: 'live', ttlMs: 8_000 },
  NEAR: { class: 'near', ttlMs: 20_000 },
  HISTORICAL: { class: 'historical', ttlMs: 120_000 },
});

const SCORE_BUCKETS = Object.freeze([
  { key: 'lt60', min: 0, max: 59.999, labelAr: 'أقل من 60' },
  { key: '60_69', min: 60, max: 69.999, labelAr: '60 - 69' },
  { key: '70_79', min: 70, max: 79.999, labelAr: '70 - 79' },
  { key: '80_89', min: 80, max: 89.999, labelAr: '80 - 89' },
  { key: '90_100', min: 90, max: 100, labelAr: '90 - 100' },
]);

const STARTED_TRAINING_STATUSES = Object.freeze([
  'ready_for_training',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'post_assessment_completed',
  'eligible_for_completion',
  'completed',
]);

const COMPLETED_TRAINING_STATUSES = Object.freeze(['eligible_for_completion', 'completed']);

const ATTENDED_STATUSES = Object.freeze(['present', 'late', 'excused']);

const NON_MEANINGFUL_AUDIT_ACTIONS = Object.freeze([
  'RECORDED_LECTURE_HEARTBEAT',
  'RECORDED_LECTURE_PLAYER_EVENT',
  'ATTENDANCE_WINDOW_POLL',
  'SESSION_PING',
  'ANALYTICS_VIEW',
  'ANALYTICS_REFRESH',
]);

const LIVE_ACTIVITY_ACTIONS = Object.freeze([
  'USER_LOGIN_SUCCESS',
  'USER_REGISTERED',
  'INSTITUTION_USER_REGISTERED',
  'enrollment_approved',
  'enrollment_requested',
  'certificate.issue',
  'certificate.status',
  'FIELD_TRAINING_STARTED',
  'FIELD_TRAINING_APPLICATION_APPROVED',
  'FIELD_TRAINING_APPLICATION_REJECTED',
  'FIELD_TRAINING_SUBMISSION_REVIEWED',
  'FIELD_TRAINING_ASSESSMENT_PUBLISHED',
  'FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM',
  'FIELD_TRAINING_COMPLETION_LETTER_ISSUED',
  'FIELD_TRAINING_ELIGIBILITY_RECALCULATED',
  'FIELD_TRAINING_PARTICIPANT_EXPELLED',
  'FT_EVAL_REPORT_GENERATED',
]);

const ROLE_CODES = Object.freeze([
  'student',
  'trainee',
  'trainer',
  'instructor',
  'admin',
  'reviewer',
  'super_admin',
]);

const KPI_KEYS = Object.freeze({
  onlineUsers: 'onlineUsers',
  activeUsers: 'activeUsers',
  totalStudents: 'totalStudents',
  trainingOpportunities: 'trainingOpportunities',
  recordedLectures: 'recordedLecturesPublished',
  certificatesIssued: 'certificatesIssued',
});

module.exports = {
  ANALYTICS_TIMEZONE,
  PRESENCE_WINDOW_SECONDS,
  MAX_CUSTOM_RANGE_DAYS,
  PERIODS,
  ORGANIZATION_TYPES,
  FRESHNESS,
  SCORE_BUCKETS,
  STARTED_TRAINING_STATUSES,
  COMPLETED_TRAINING_STATUSES,
  ATTENDED_STATUSES,
  NON_MEANINGFUL_AUDIT_ACTIONS,
  LIVE_ACTIVITY_ACTIONS,
  ROLE_CODES,
  KPI_KEYS,
};
