'use strict';

/**
 * Security events = audit_logs rows whose action is registered with a `security`
 * category/severity (shared/audit/auditActions.js). This module is the single entry point
 * for writing them from middleware/guards:
 *   - event types, categories, outcomes and severities come from the registry only;
 *   - metadata is sanitized (no passwords/tokens/cookies/OTPs) and size-bounded;
 *   - repeated identical events are deduplicated in-process (bots, retry loops);
 *   - writes never throw and never change the security decision already taken.
 */

const { recordAudit } = require('../services/audit.service');
const { AUDIT_OUTCOMES, securityMetaForAction } = require('../audit/auditActions');
const { sanitizeForLog, boundString } = require('./redaction');
const { getSecurityClientIp } = require('./clientIdentity');
const { logger } = require('../../utils/logger');

const DEFAULT_DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const DEDUPE_MAX = 10_000;
const seen = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_IN_PATH_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const METADATA_LIMITS = Object.freeze({ maxString: 200, maxKeys: 20, maxArray: 20, maxDepth: 3 });

function shouldRecord(key, windowMs, nowMs = Date.now()) {
  const last = seen.get(key);
  if (last !== undefined && nowMs - last < windowMs) return false;
  if (seen.size >= DEDUPE_MAX) seen.delete(seen.keys().next().value);
  seen.delete(key);
  seen.set(key, nowMs);
  return true;
}

function asUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/** Route pattern (no ids, no query string) for metadata and dedupe keys. */
function routeOf(req) {
  if (!req) return null;
  const routePath = req.route?.path;
  if (typeof routePath === 'string') return boundString(`${req.baseUrl || ''}${routePath}`, 200);
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return boundString(path.replace(UUID_IN_PATH_RE, ':id').replace(/\/\d+(?=\/|$)/g, '/:n'), 200);
}

/**
 * @param {{
 *   eventType: string,
 *   outcome?: 'SUCCESS'|'FAILED'|'DENIED'|'BLOCKED',
 *   severity?: 'INFO'|'WARNING'|'HIGH'|'CRITICAL',
 *   req?: import('express').Request,
 *   userId?: string|null,
 *   subjectUserId?: string|null,
 *   universityId?: string|null,
 *   organizationId?: string|null,
 *   entityType?: string,
 *   entityId?: string|null,
 *   reason?: string,
 *   metadata?: Record<string, unknown>,
 *   dedupeKey?: string,
 *   dedupeWindowMs?: number,
 * }} event
 */
async function recordSecurityEvent(event) {
  try {
    const meta = securityMetaForAction(event?.eventType);
    if (!meta) {
      logger.error('SECURITY_EVENT_NOT_REGISTERED', { eventType: boundString(event?.eventType, 120) });
      return null;
    }
    if (event.dedupeKey) {
      const windowMs = event.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
      if (!shouldRecord(`${event.eventType}|${event.dedupeKey}`, windowMs)) return null;
    }
    const req = event.req;
    const outcome = AUDIT_OUTCOMES[String(event.outcome || '').toUpperCase()] || AUDIT_OUTCOMES.FAILED;
    const newValues = sanitizeForLog(
      {
        reason: boundString(event.reason, 80) || undefined,
        method: req ? String(req.method || '').toUpperCase().slice(0, 10) : undefined,
        route: req ? routeOf(req) || undefined : undefined,
        ...(event.metadata || {}),
      },
      METADATA_LIMITS
    );
    for (const key of Object.keys(newValues)) if (newValues[key] === undefined) delete newValues[key];

    const severity = event.severity || meta.severity;
    if (severity !== 'INFO') {
      logger.warn('SECURITY_EVENT', {
        eventCode: event.eventType,
        securityCategory: meta.category,
        severity,
        outcome,
        reason: newValues.reason || null,
        route: newValues.route || null,
      });
    }

    return await recordAudit({
      ...(event.userId !== undefined ? { userId: asUuid(event.userId) } : {}),
      subjectUserId: asUuid(event.subjectUserId) ?? null,
      ...(event.universityId ? { universityId: asUuid(event.universityId) } : {}),
      ...(event.organizationId ? { organizationId: asUuid(event.organizationId) } : {}),
      actionType: event.eventType,
      entityType: event.entityType || 'security_event',
      entityId: asUuid(event.entityId),
      outcome,
      severity: event.severity,
      newValues,
      ...(req ? { ipAddress: getSecurityClientIp(req) } : {}),
    });
  } catch (err) {
    logger.error('SECURITY_EVENT_WRITE_FAILED', {
      eventType: boundString(event?.eventType, 120),
      error: String(err?.message || err).slice(0, 300),
    });
    return null;
  }
}

/** 403 codes that are access-control denials (business-state 403s are not security events). */
const AUTHORIZATION_DENIAL_CODES = new Set([
  'FORBIDDEN',
  'ROLE_NOT_ALLOWED',
  'PORTAL_MISMATCH',
  'REVIEWER_READ_ONLY',
  'REVIEWER_ASSIGN_FORBIDDEN',
  'REPORT_READ_ONLY',
  'FIELD_TRAINING_FORBIDDEN',
  'FILE_FORBIDDEN',
  'TRAINER_PERMISSION_REQUIRED',
  'TRAINER_ASSIGNMENT_REQUIRED',
  'SUPPORT_STUDENT_ONLY',
]);

/** 403 codes that always mean "valid user, someone else's university/organization". */
const CROSS_SCOPE_CODES = new Set(['FIELD_TRAINING_UNIVERSITY_FORBIDDEN', 'CROSS_SCOPE_FORBIDDEN']);

/**
 * Map a thrown 403 to the one security event it represents (or null for business 403s).
 * @param {{ statusCode?: number, code?: string, securityEvent?: string, scopeType?: string }} err
 */
function classifyForbiddenError(err) {
  if (!err || err.statusCode !== 403) return null;
  const code = typeof err.code === 'string' ? err.code : null;
  if (err.securityEvent === 'CROSS_SCOPE_ACCESS_DENIED' || (code && CROSS_SCOPE_CODES.has(code))) {
    return { eventType: 'CROSS_SCOPE_ACCESS_DENIED', reason: code || 'CROSS_SCOPE', scopeType: err.scopeType || null };
  }
  if (!code || AUTHORIZATION_DENIAL_CODES.has(code)) {
    return { eventType: 'AUTHORIZATION_DENIED', reason: code || 'FORBIDDEN', scopeType: null };
  }
  return null;
}

const DENIAL_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Record exactly one authorization denial per request for an authenticated user.
 * Owner: authorization/permission middleware for route-level denials; the error middleware
 * for 403s thrown by service-level scope guards. The request flag prevents duplicates.
 * @param {import('express').Request} req
 * @param {{ eventType?: 'AUTHORIZATION_DENIED'|'CROSS_SCOPE_ACCESS_DENIED', reason?: string, code?: string,
 *   requiredRoles?: string[], requiredPermissions?: string[], scopeType?: string|null }} [details]
 */
function recordAuthorizationDenial(req, details = {}) {
  if (!req || req.securityDenialRecorded) return null;
  const userId = req.user?.userId;
  if (!userId) return null;
  req.securityDenialRecorded = true;
  const eventType = details.eventType || 'AUTHORIZATION_DENIED';
  const route = routeOf(req);
  const reason = details.reason || details.code || 'FORBIDDEN';
  return recordSecurityEvent({
    eventType,
    outcome: 'DENIED',
    req,
    userId,
    entityType: 'route',
    reason,
    metadata: {
      code: details.code || undefined,
      scopeType: details.scopeType || undefined,
      requiredRoles: Array.isArray(details.requiredRoles) ? details.requiredRoles.slice(0, 10) : undefined,
      requiredPermissions: Array.isArray(details.requiredPermissions)
        ? details.requiredPermissions.slice(0, 10)
        : undefined,
      actorUniversityId: asUuid(req.user?.universityId) || undefined,
      actorOrganizationId: asUuid(req.user?.organizationId) || undefined,
    },
    dedupeKey: `${userId}|${String(req.method || '').toUpperCase()}|${route}|${reason}`,
    dedupeWindowMs: DENIAL_DEDUPE_WINDOW_MS,
  });
}

function resetSecurityEventDedupeForTests() {
  seen.clear();
}

module.exports = {
  recordSecurityEvent,
  recordAuthorizationDenial,
  classifyForbiddenError,
  routeOf,
  AUTHORIZATION_DENIAL_CODES,
  CROSS_SCOPE_CODES,
  resetSecurityEventDedupeForTests,
};
