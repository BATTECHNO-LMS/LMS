'use strict';

/**
 * Security events raised by the auth layer (TOKEN_INVALID, TOKEN_EXPIRED). Deduplicated per
 * client so a retry loop or a stale tab cannot flood audit_logs. A request without any token
 * is not recorded (anonymous scanner noise). Never records the token, Authorization header
 * or cookies.
 */

const {
  recordSecurityEvent,
  recordAuthorizationDenial,
  resetSecurityEventDedupeForTests,
} = require('../../shared/security/securityEvents');
const { getSecurityClientIp } = require('../../shared/security/clientIdentity');

/**
 * @param {import('express').Request} req
 * @param {'TOKEN_INVALID'|'TOKEN_EXPIRED'} actionType
 * @param {{ reason?: string, userId?: string|null }} [details]
 */
function recordTokenFailure(req, actionType, details = {}) {
  const ip = getSecurityClientIp(req) || 'unknown';
  recordSecurityEvent({
    eventType: actionType,
    outcome: 'DENIED',
    req,
    userId: details.userId || null,
    subjectUserId: details.userId || null,
    entityType: 'auth_token',
    reason: details.reason || null,
    dedupeKey: `${ip}|${details.userId || ''}|${details.reason || ''}`,
  });
}

/** @deprecated use recordAuthorizationDenial (shared/security/securityEvents). */
function recordPermissionDenied(req, details = {}) {
  return recordAuthorizationDenial(req, { reason: 'ROLE_NOT_ALLOWED', requiredRoles: details.requiredRoles });
}

module.exports = { recordTokenFailure, recordPermissionDenied, resetSecurityEventDedupeForTests };
