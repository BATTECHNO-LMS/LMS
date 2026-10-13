'use strict';

/**
 * Navigation "opened" audit events (COURSE_OPENED, ASSIGNMENT_OPENED, ...).
 * Deduplicated per session + action + entity within AUDIT_NAVIGATION_DEDUPE_MINUTES so
 * re-renders, tab switches and refreshes do not flood the audit trail.
 * Navigation never touches the session's idle clock (the client sends a separate
 * activity ping for real interaction).
 */

const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const { recordAudit } = require('../../shared/services/audit.service');
const { NAVIGATION_ACTIONS } = require('../../shared/audit/auditActions');

const ENTITY_TYPE_BY_MODULE = Object.freeze({
  COURSE: 'training_program',
  ASSIGNMENT: 'training_task',
  FIELD_TRAINING: 'field_training_opportunity',
  REPORT: 'report',
  RECORDED_LECTURE: 'field_training_recorded_lecture',
});

const ALLOWED_ENTITY_TYPES = Object.freeze({
  COURSE: ['training_program', 'course'],
  ASSIGNMENT: ['training_task', 'field_training_task'],
  FIELD_TRAINING: ['field_training_opportunity', 'field_training_application'],
  REPORT: ['report', 'field_training_report'],
  RECORDED_LECTURE: ['field_training_recorded_lecture', 'training_recorded_lecture'],
});

const REPORT_KEY_RE = /^[a-z0-9_.-]{1,60}$/;
const MEMORY_MAX = 20_000;
const recent = new Map();

function dedupeKey({ sessionId, userId, action, entityId, reportKey }) {
  return `${sessionId || userId}:${action}:${entityId || reportKey || '-'}`;
}

function seenRecently(key, nowMs, windowMs) {
  const at = recent.get(key);
  return Boolean(at && nowMs - at < windowMs);
}

function remember(key, nowMs) {
  if (recent.size >= MEMORY_MAX) recent.delete(recent.keys().next().value);
  recent.set(key, nowMs);
}

/**
 * @param {{ userId: string, sessionId?: string|null, module: string, entityId?: string|null, entityType?: string|null, reportKey?: string|null }} input
 * @returns {Promise<{ recorded: boolean, action: string }>}
 */
async function recordNavigation(input, { now = new Date() } = {}) {
  const action = NAVIGATION_ACTIONS[input.module];
  if (!action) return { recorded: false, action: null };
  const windowMs = env.AUDIT_NAVIGATION_DEDUPE_MINUTES * 60_000;
  const nowMs = now.getTime();
  const reportKey = input.reportKey && REPORT_KEY_RE.test(input.reportKey) ? input.reportKey : null;
  const key = dedupeKey({ ...input, action, reportKey });
  if (seenRecently(key, nowMs, windowMs)) return { recorded: false, action };
  remember(key, nowMs);

  const since = new Date(nowMs - windowMs);
  const existing = await prisma.audit_logs.findFirst({
    where: {
      action_type: action,
      user_id: input.userId,
      created_at: { gte: since },
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      ...(input.entityId ? { entity_id: input.entityId } : {}),
      ...(!input.entityId && reportKey ? { new_values: { path: ['reportKey'], equals: reportKey } } : {}),
    },
    select: { id: true },
  });
  if (existing) return { recorded: false, action };

  const allowed = ALLOWED_ENTITY_TYPES[input.module] || [];
  const entityType = input.entityType && allowed.includes(input.entityType)
    ? input.entityType
    : ENTITY_TYPE_BY_MODULE[input.module];
  await recordAudit({
    userId: input.userId,
    subjectUserId: input.userId,
    actionType: action,
    entityType,
    entityId: input.entityId || null,
    newValues: reportKey ? { reportKey } : undefined,
  });
  return { recorded: true, action };
}

function resetNavigationDedupeForTests() {
  recent.clear();
}

module.exports = { recordNavigation, resetNavigationDedupeForTests, ENTITY_TYPE_BY_MODULE };
