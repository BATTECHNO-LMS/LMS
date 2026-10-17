const { prisma } = require('../../config/db');
const { getRequestContext } = require('../requestContext');
const {
  getAuditActionMeta,
  AUDIT_OUTCOMES,
  SECURITY_CRITICAL_CATEGORIES,
  AUDIT_CATEGORIES,
  SECURITY_SEVERITIES,
} = require('../audit/auditActions');
const { logger } = require('../../utils/logger');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** entity_type → { model, column } holding the affected user (student/trainee). */
const SUBJECT_ENTITY_LOOKUP = Object.freeze({
  field_training_application: { model: 'field_training_applications', column: 'student_id' },
  field_training_task_submission: { model: 'field_training_task_submissions', column: 'student_id' },
  field_training_attendance: { model: 'field_training_attendance', column: 'student_id' },
  field_training_completion_letter: { model: 'field_training_completion_letters', column: 'student_id' },
  field_training_supervisor_rating: { model: 'field_training_supervisor_ratings', column: 'student_id' },
  field_training_final_evaluation: { model: 'field_training_final_evaluations', column: 'student_id' },
  field_training_assessment_attempt: { model: 'field_training_assessment_attempts', column: 'student_id' },
  enrollment: { model: 'enrollments', column: 'student_id' },
  training_enrollment: { model: 'training_enrollments', column: 'user_id' },
  training_task_submission: { model: 'training_task_submissions', column: 'user_id' },
  training_attendance_record: { model: 'training_attendance_records', column: 'user_id' },
  training_assessment_attempt: { model: 'training_assessment_attempts', column: 'user_id' },
  training_evaluation_assignment: { model: 'training_evaluation_assignments', column: 'user_id' },
  account_deletion_request: { model: 'account_deletion_requests', column: 'user_id' },
  certificate: { model: 'certificates', column: 'student_id' },
  integrity_case: { model: 'integrity_cases', column: 'student_id' },
  user_organization_assignment: { model: 'user_organization_assignments', column: 'user_id' },
});

const SUBJECT_VALUE_KEYS = ['subject_user_id', 'subjectUserId', 'student_id', 'studentId'];

const warnedUnknownActions = new Set();

function asUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

function subjectFromValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
  for (const key of SUBJECT_VALUE_KEYS) {
    const id = asUuid(values[key]);
    if (id) return id;
  }
  return null;
}

async function subjectFromEntity(entityType, entityId) {
  const lookup = SUBJECT_ENTITY_LOOKUP[entityType];
  const id = asUuid(entityId);
  if (!lookup || !id) return null;
  const delegate = prisma[lookup.model];
  if (!delegate?.findUnique) return null;
  try {
    const row = await delegate.findUnique({ where: { id }, select: { [lookup.column]: true } });
    return asUuid(row?.[lookup.column]);
  } catch {
    return null;
  }
}

/**
 * Resolve the user whose data/state an action affected.
 * Explicit `subjectUserId` wins; then registry `subjectFromEntity` (entity is the user);
 * then student/subject keys in values; then a lookup on known student-owned entities.
 */
async function resolveSubjectUserId(payload, meta) {
  if (payload.subjectUserId !== undefined) return asUuid(payload.subjectUserId);
  if (meta?.subjectFromEntity && payload.entityType === 'user') {
    const id = asUuid(payload.entityId);
    if (id) return id;
  }
  const fromValues = subjectFromValues(payload.newValues) || subjectFromValues(payload.oldValues);
  if (fromValues) return fromValues;
  return subjectFromEntity(payload.entityType, payload.entityId);
}

const TENANT_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_CACHE_MAX = 5_000;
const tenantCache = new Map();

/** University / organization a user belongs to (cached). Used to scope audit rows. */
async function resolveUserTenant(userId) {
  const id = asUuid(userId);
  if (!id) return null;
  const hit = tenantCache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  let value = null;
  try {
    const user = await prisma.users.findUnique({
      where: { id },
      select: { primary_university_id: true },
    });
    if (user) {
      let organizationId = null;
      const assignment = await prisma.user_organization_assignments.findFirst({
        where: { user_id: id, is_active: true },
        orderBy: { assigned_at: 'asc' },
        select: { organization_id: true },
      });
      organizationId = assignment?.organization_id ?? null;
      if (!organizationId && user.primary_university_id) {
        const uni = await prisma.universities.findUnique({
          where: { id: user.primary_university_id },
          select: { organization_id: true },
        });
        organizationId = uni?.organization_id ?? null;
      }
      value = { universityId: user.primary_university_id ?? null, organizationId };
    }
  } catch {
    value = null;
  }
  if (tenantCache.size >= TENANT_CACHE_MAX) tenantCache.delete(tenantCache.keys().next().value);
  tenantCache.set(id, { value, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
  return value;
}

function clearAuditTenantCacheForTests() {
  tenantCache.clear();
}

function resolveCategory(payload, meta) {
  if (payload.category && AUDIT_CATEGORIES[payload.category]) return payload.category;
  if (meta) return meta.category;
  if (!warnedUnknownActions.has(payload.actionType)) {
    warnedUnknownActions.add(payload.actionType);
    logger.error('AUDIT_ACTION_NOT_REGISTERED', { actionType: String(payload.actionType).slice(0, 120) });
  }
  return AUDIT_CATEGORIES.SYSTEM;
}

function resolveOutcome(payload) {
  const outcome = payload.outcome ? String(payload.outcome).toUpperCase() : AUDIT_OUTCOMES.SUCCESS;
  return AUDIT_OUTCOMES[outcome] || AUDIT_OUTCOMES.SUCCESS;
}

/** Security columns come from the registry; callers may only escalate severity to a known value. */
function resolveSecurityFields(payload, meta) {
  if (!meta?.security) return { security_category: null, severity: null };
  const requested = payload.severity ? String(payload.severity).toUpperCase() : null;
  return {
    security_category: meta.security.category,
    severity: (requested && SECURITY_SEVERITIES[requested]) || meta.security.severity,
  };
}

async function buildAuditRow(payload) {
  const ctx = getRequestContext() || {};
  const meta = getAuditActionMeta(payload.actionType);
  const subjectUserId = await resolveSubjectUserId(payload, meta);
  const actorUserId = payload.userId !== undefined ? payload.userId ?? null : ctx.userId ?? null;
  const sameActor = actorUserId && ctx.userId && actorUserId === ctx.userId;
  let universityId = payload.universityId ?? null;
  let organizationId = payload.organizationId ?? null;
  if (!universityId && !organizationId && payload.skipTenantResolution !== true) {
    const tenant =
      (subjectUserId && (await resolveUserTenant(subjectUserId))) ||
      (actorUserId && (await resolveUserTenant(actorUserId))) ||
      null;
    universityId = tenant?.universityId ?? null;
    organizationId = tenant?.organizationId ?? null;
  }
  return {
    user_id: actorUserId,
    university_id: universityId,
    organization_id: organizationId,
    action_type: payload.actionType,
    entity_type: payload.entityType,
    entity_id: asUuid(payload.entityId),
    old_values: payload.oldValues ?? undefined,
    new_values: payload.newValues ?? undefined,
    ip_address: (payload.ipAddress ?? ctx.ipAddress ?? null)?.toString().slice(0, 64) || null,
    subject_user_id: subjectUserId,
    session_id: asUuid(payload.sessionId !== undefined ? payload.sessionId : sameActor ? ctx.sessionId : null),
    request_id: (payload.requestId ?? ctx.requestId ?? null)?.toString().slice(0, 128) || null,
    category: resolveCategory(payload, meta),
    outcome: resolveOutcome(payload),
    actor_role:
      (payload.actorRole ?? (sameActor || (!payload.userId && ctx.userId) ? ctx.actorRole : null) ?? null)
        ?.toString()
        .slice(0, 40) || null,
    user_agent: (payload.userAgent ?? ctx.userAgent ?? null)?.toString().slice(0, 512) || null,
    ...resolveSecurityFields(payload, meta),
  };
}

function isMissingAuditTable(err) {
  const msg = String(err?.message || '');
  return err?.code === 'P2021' || (msg.includes('audit_logs') && msg.includes('does not exist'));
}

function logAuditFailure(row, err, attempt) {
  const critical = SECURITY_CRITICAL_CATEGORIES.has(row.category);
  const fields = {
    actionType: row.action_type,
    category: row.category,
    securityCategory: row.security_category,
    severity: row.severity,
    ipAddress: row.ip_address,
    outcome: row.outcome,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorUserId: row.user_id,
    subjectUserId: row.subject_user_id,
    sessionId: row.session_id,
    requestId: row.request_id,
    attempt,
    errorCode: err?.code || null,
    error: String(err?.message || err).slice(0, 300),
  };
  if (critical) logger.error('AUDIT_WRITE_FAILED_SECURITY_EVENT', fields);
  else logger.error('AUDIT_WRITE_FAILED', fields);
}

/**
 * Persist an audit log row.
 *
 * Failure policy: by default a failed audit write never fails the business action that
 * already succeeded. The write is retried once; if it still fails the full event metadata
 * (no secrets) is emitted as a structured error log so it is not silently lost.
 * Pass `{ strict: true }` to rethrow (for callers that must fail closed).
 *
 * @param {{
 *   userId?: string | null,          actor (defaults to the authenticated request user)
 *   subjectUserId?: string | null,   affected user (resolved automatically when omitted)
 *   universityId?: string | null,
 *   organizationId?: string | null,
 *   actionType: string,
 *   entityType: string,
 *   entityId?: string | null,
 *   oldValues?: unknown,
 *   newValues?: unknown,
 *   ipAddress?: string | null,
 *   category?: string,
 *   outcome?: 'SUCCESS' | 'FAILED' | 'DENIED' | 'BLOCKED',
 *   severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL',  only for registered security actions
 *   sessionId?: string | null,
 *   requestId?: string | null,
 *   actorRole?: string | null,
 *   userAgent?: string | null,
 * }} payload
 * @param {{ strict?: boolean }} [options]
 */
async function recordAudit(payload, options = {}) {
  let row;
  try {
    row = await buildAuditRow(payload);
  } catch (err) {
    if (options.strict) throw err;
    logger.error('AUDIT_BUILD_FAILED', {
      actionType: String(payload?.actionType || '').slice(0, 120),
      error: String(err?.message || err).slice(0, 300),
    });
    return null;
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await prisma.audit_logs.create({ data: row });
    } catch (err) {
      if (isMissingAuditTable(err)) {
        logger.warn('AUDIT_TABLE_MISSING', { actionType: row.action_type });
        return null;
      }
      logAuditFailure(row, err, attempt);
      if (attempt === 2) {
        if (options.strict) throw err;
        return null;
      }
    }
  }
  return null;
}

async function recordAuditMany(payloads, options = {}) {
  const valid = (payloads || []).filter((payload) => payload && payload.actionType && payload.entityType);
  if (!valid.length) return { count: 0 };
  let rows;
  try {
    rows = await Promise.all(valid.map((payload) => buildAuditRow(payload)));
  } catch (err) {
    if (options.strict) throw err;
    logger.error('AUDIT_BUILD_FAILED', { count: valid.length, error: String(err?.message || err).slice(0, 300) });
    return { count: 0 };
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await prisma.audit_logs.createMany({ data: rows });
    } catch (err) {
      if (isMissingAuditTable(err)) return { count: 0 };
      logAuditFailure(rows[0], err, attempt);
      if (attempt === 2) {
        if (options.strict) throw err;
        return { count: 0 };
      }
    }
  }
  return { count: 0 };
}

module.exports = {
  recordAudit,
  recordAuditMany,
  buildAuditRow,
  resolveSubjectUserId,
  resolveUserTenant,
  clearAuditTenantCacheForTests,
  SUBJECT_ENTITY_LOOKUP,
};
