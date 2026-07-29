'use strict';

/**
 * Central catalog of domain notification events, categories, priorities, and channels.
 * Unknown event types must never create notifications (see notificationDispatcher).
 */

const CATEGORIES = Object.freeze([
  'ACCOUNT',
  'OPPORTUNITY',
  'APPLICATION',
  'SESSION',
  'ATTENDANCE',
  'TASK',
  'TEST',
  'PROGRESS',
  'CERTIFICATE',
  'REPORT',
  'SUPPORT',
  'ANNOUNCEMENT',
  'SYSTEM',
]);

const PRIORITIES = Object.freeze(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

const CHANNELS = Object.freeze([
  'IN_APP',
  'NOTIFICATION_CENTER',
  'BELL',
  'POPUP',
  'TOP_BANNER',
  'EMAIL',
  'PUSH',
]);

const ALLOWED_TEMPLATE_VARS = Object.freeze([
  'student_name',
  'instructor_name',
  'actor_name',
  'email',
  'opportunity_name',
  'session_title',
  'session_date',
  'session_time',
  'task_title',
  'deadline',
  'university_name',
  'attendance_status',
  'score',
  'certificate_name',
  'support_ticket_number',
  'activation_wait_hours',
  'action_label',
  'action_url',
  'entity_type',
  'entity_id',
]);

/** @type {Record<string, { category: string, priority: string, isCritical?: boolean, requiresAcknowledgement?: boolean }>} */
const EVENT_META = Object.freeze({
  USER_REGISTERED: { category: 'ACCOUNT', priority: 'NORMAL' },
  EMAIL_VERIFICATION_SENT: { category: 'ACCOUNT', priority: 'NORMAL' },
  EMAIL_VERIFIED: { category: 'ACCOUNT', priority: 'NORMAL' },
  ACCOUNT_PENDING_ACTIVATION: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  ACCOUNT_ACTIVATED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  ACCOUNT_REJECTED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  ACCOUNT_DISABLED: { category: 'ACCOUNT', priority: 'URGENT', isCritical: true },
  ACCOUNT_REACTIVATED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  ACCOUNT_ACTIVATION_DELAYED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  PASSWORD_RESET_REQUESTED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },
  PASSWORD_CHANGED: { category: 'ACCOUNT', priority: 'HIGH', isCritical: true },

  OPPORTUNITY_CREATED: { category: 'OPPORTUNITY', priority: 'NORMAL' },
  OPPORTUNITY_PUBLISHED: { category: 'OPPORTUNITY', priority: 'NORMAL' },
  OPPORTUNITY_UPDATED: { category: 'OPPORTUNITY', priority: 'LOW' },
  OPPORTUNITY_REGISTRATION_OPENED: { category: 'OPPORTUNITY', priority: 'HIGH' },
  OPPORTUNITY_REGISTRATION_CLOSED: { category: 'OPPORTUNITY', priority: 'NORMAL' },

  APPLICATION_SUBMITTED: { category: 'APPLICATION', priority: 'NORMAL' },
  APPLICATION_ACCEPTED: { category: 'APPLICATION', priority: 'HIGH', isCritical: true },
  APPLICATION_REJECTED: { category: 'APPLICATION', priority: 'HIGH', isCritical: true },
  APPLICATION_NEEDS_UPDATE: { category: 'APPLICATION', priority: 'HIGH' },
  APPLICATION_WITHDRAWN: { category: 'APPLICATION', priority: 'NORMAL' },
  STUDENT_ENROLLED: { category: 'APPLICATION', priority: 'NORMAL' },
  STUDENT_REMOVED_FROM_TRAINING: { category: 'APPLICATION', priority: 'HIGH', isCritical: true },

  SESSION_CREATED: { category: 'SESSION', priority: 'NORMAL' },
  SESSION_UPDATED: { category: 'SESSION', priority: 'NORMAL' },
  SESSION_RESCHEDULED: { category: 'SESSION', priority: 'HIGH', isCritical: true },
  SESSION_CANCELLED: { category: 'SESSION', priority: 'URGENT', isCritical: true },
  SESSION_STARTING_SOON: { category: 'SESSION', priority: 'HIGH' },
  SESSION_STARTED: { category: 'SESSION', priority: 'NORMAL' },
  SESSION_COMPLETED: { category: 'SESSION', priority: 'LOW' },
  ZOOM_LINK_ADDED: { category: 'SESSION', priority: 'HIGH' },
  ZOOM_LINK_UPDATED: { category: 'SESSION', priority: 'HIGH' },

  ATTENDANCE_WINDOW_OPENED: { category: 'ATTENDANCE', priority: 'URGENT', isCritical: true },
  ATTENDANCE_WINDOW_CLOSING_SOON: { category: 'ATTENDANCE', priority: 'HIGH', isCritical: true },
  ATTENDANCE_WINDOW_CLOSED: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_CONFIRMED: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_MARKED_PRESENT: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_MARKED_ABSENT: { category: 'ATTENDANCE', priority: 'HIGH' },
  ATTENDANCE_MARKED_LATE: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_MARKED_EXCUSED: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_UNCONFIRMED: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_MANUALLY_UPDATED: { category: 'ATTENDANCE', priority: 'NORMAL' },
  ATTENDANCE_ABSENCES_FINALIZED: { category: 'ATTENDANCE', priority: 'HIGH' },

  TASK_CREATED: { category: 'TASK', priority: 'LOW' },
  TASK_PUBLISHED: { category: 'TASK', priority: 'NORMAL' },
  TASK_UPDATED: { category: 'TASK', priority: 'LOW' },
  TASK_DEADLINE_APPROACHING: { category: 'TASK', priority: 'HIGH' },
  TASK_DEADLINE_PASSED: { category: 'TASK', priority: 'HIGH', isCritical: true },
  TASK_SUBMITTED: { category: 'TASK', priority: 'NORMAL' },
  TASK_RESUBMITTED: { category: 'TASK', priority: 'NORMAL' },
  TASK_AI_EVALUATED: { category: 'TASK', priority: 'NORMAL' },
  TASK_MANUAL_REVIEW_REQUIRED: { category: 'TASK', priority: 'HIGH' },
  TASK_GRADED: { category: 'TASK', priority: 'NORMAL' },
  TASK_REVISION_REQUESTED: { category: 'TASK', priority: 'HIGH' },
  TASK_ACCEPTED: { category: 'TASK', priority: 'NORMAL' },
  TASK_REJECTED: { category: 'TASK', priority: 'HIGH' },
  FINAL_TASK_AVAILABLE: { category: 'TASK', priority: 'HIGH' },
  FINAL_TASK_COMPLETED: { category: 'TASK', priority: 'NORMAL' },

  PRE_TEST_AVAILABLE: { category: 'TEST', priority: 'NORMAL' },
  PRE_TEST_STARTED: { category: 'TEST', priority: 'LOW' },
  PRE_TEST_SUBMITTED: { category: 'TEST', priority: 'NORMAL' },
  PRE_TEST_GRADED: { category: 'TEST', priority: 'NORMAL' },
  POST_TEST_AVAILABLE: { category: 'TEST', priority: 'NORMAL' },
  POST_TEST_STARTED: { category: 'TEST', priority: 'LOW' },
  POST_TEST_SUBMITTED: { category: 'TEST', priority: 'NORMAL' },
  POST_TEST_GRADED: { category: 'TEST', priority: 'NORMAL' },
  TEST_DEADLINE_APPROACHING: { category: 'TEST', priority: 'HIGH' },
  TEST_TIME_EXPIRED: { category: 'TEST', priority: 'HIGH' },

  TRAINING_PROGRESS_UPDATED: { category: 'PROGRESS', priority: 'LOW' },
  TRAINING_HOURS_UPDATED: { category: 'PROGRESS', priority: 'LOW' },
  ATTENDANCE_RATE_LOW: { category: 'PROGRESS', priority: 'HIGH' },
  TASK_COMPLETION_RATE_LOW: { category: 'PROGRESS', priority: 'HIGH' },
  STUDENT_AT_RISK: { category: 'PROGRESS', priority: 'HIGH', isCritical: true },
  TRAINING_REQUIREMENTS_COMPLETED: { category: 'PROGRESS', priority: 'HIGH' },
  TRAINING_COMPLETED: { category: 'PROGRESS', priority: 'HIGH' },
  TRAINING_APPROVED: { category: 'PROGRESS', priority: 'HIGH', isCritical: true },

  CERTIFICATE_ELIGIBLE: { category: 'CERTIFICATE', priority: 'HIGH' },
  CERTIFICATE_ISSUED: { category: 'CERTIFICATE', priority: 'HIGH', isCritical: true },
  CERTIFICATE_UPDATED: { category: 'CERTIFICATE', priority: 'NORMAL' },
  CERTIFICATE_REVOKED: { category: 'CERTIFICATE', priority: 'URGENT', isCritical: true },
  TRAINING_LETTER_ISSUED: { category: 'CERTIFICATE', priority: 'HIGH' },
  DOCUMENT_AVAILABLE: { category: 'CERTIFICATE', priority: 'NORMAL' },

  UNIVERSITY_REPORT_READY: { category: 'REPORT', priority: 'NORMAL' },
  UNIVERSITY_REPORT_UPDATED: { category: 'REPORT', priority: 'LOW' },
  UNIVERSITY_ATTENDANCE_ALERT: { category: 'REPORT', priority: 'HIGH' },
  UNIVERSITY_STUDENTS_AT_RISK: { category: 'REPORT', priority: 'HIGH' },
  UNIVERSITY_RESULTS_APPROVED: { category: 'REPORT', priority: 'NORMAL' },
  UNIVERSITY_CERTIFICATES_ISSUED: { category: 'REPORT', priority: 'NORMAL' },

  SUPPORT_TICKET_CREATED: { category: 'SUPPORT', priority: 'NORMAL' },
  SUPPORT_TICKET_UPDATED: { category: 'SUPPORT', priority: 'NORMAL' },
  SUPPORT_TICKET_REPLIED: { category: 'SUPPORT', priority: 'NORMAL' },
  SUPPORT_TICKET_CLOSED: { category: 'SUPPORT', priority: 'LOW' },

  ANNOUNCEMENT_PUBLISHED: { category: 'ANNOUNCEMENT', priority: 'NORMAL' },
  ANNOUNCEMENT_UPDATED: { category: 'ANNOUNCEMENT', priority: 'LOW' },
  ANNOUNCEMENT_ACKNOWLEDGEMENT_REQUIRED: {
    category: 'ANNOUNCEMENT',
    priority: 'URGENT',
    isCritical: true,
    requiresAcknowledgement: true,
  },
  USER_GUIDE_UPDATED: { category: 'ANNOUNCEMENT', priority: 'LOW' },

  ADMIN_ACTION_REQUIRED: { category: 'SYSTEM', priority: 'HIGH', isCritical: true },
  SYSTEM_MAINTENANCE_SCHEDULED: { category: 'SYSTEM', priority: 'HIGH', isCritical: true },
  SYSTEM_MAINTENANCE_STARTED: { category: 'SYSTEM', priority: 'URGENT', isCritical: true },
  SYSTEM_MAINTENANCE_COMPLETED: { category: 'SYSTEM', priority: 'NORMAL' },
  CRITICAL_OPERATION_FAILED: { category: 'SYSTEM', priority: 'URGENT', isCritical: true },
  DAILY_SUMMARY_READY: { category: 'SYSTEM', priority: 'LOW' },
  WEEKLY_SUMMARY_READY: { category: 'SYSTEM', priority: 'LOW' },
});

const NOTIFICATION_EVENTS = Object.freeze(Object.keys(EVENT_META));

const EVENT_SET = new Set(NOTIFICATION_EVENTS);

/**
 * @param {unknown} type
 * @returns {boolean}
 */
function isKnownEvent(type) {
  return EVENT_SET.has(String(type || ''));
}

/**
 * @param {unknown} type
 * @returns {{ eventType: string, category: string, priority: string, isCritical: boolean, requiresAcknowledgement: boolean } | null}
 */
function getEventMeta(type) {
  const eventType = String(type || '');
  const meta = EVENT_META[eventType];
  if (!meta) return null;
  return {
    eventType,
    category: meta.category,
    priority: meta.priority,
    isCritical: Boolean(meta.isCritical),
    requiresAcknowledgement: Boolean(meta.requiresAcknowledgement),
  };
}

module.exports = {
  NOTIFICATION_EVENTS,
  EVENT_META,
  CATEGORIES,
  PRIORITIES,
  CHANNELS,
  ALLOWED_TEMPLATE_VARS,
  isKnownEvent,
  getEventMeta,
};
