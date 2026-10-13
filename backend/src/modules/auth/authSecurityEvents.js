'use strict';

/**
 * Security audit events raised by the auth layer (TOKEN_INVALID, TOKEN_EXPIRED,
 * PERMISSION_DENIED). Deduplicated in-process so a client retry loop or a stale tab
 * cannot flood audit_logs. Never records the token, Authorization header or cookies.
 */

const { recordAudit } = require('../../shared/services/audit.service');
const { AUDIT_OUTCOMES } = require('../../shared/audit/auditActions');

const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const DEDUPE_MAX = 5_000;
const seen = new Map();

function shouldRecord(key, nowMs) {
  const last = seen.get(key);
  if (last && nowMs - last < DEDUPE_WINDOW_MS) return false;
  if (seen.size >= DEDUPE_MAX) seen.delete(seen.keys().next().value);
  seen.set(key, nowMs);
  return true;
}

function safePath(req) {
  const raw = String(req.originalUrl || req.url || '');
  return raw.split('?')[0].slice(0, 200);
}

/**
 * @param {import('express').Request} req
 * @param {'TOKEN_INVALID'|'TOKEN_EXPIRED'} actionType
 * @param {{ reason?: string, userId?: string|null }} [details]
 */
function recordTokenFailure(req, actionType, details = {}) {
  const ip = req.ip || 'unknown';
  if (!shouldRecord(`${actionType}:${ip}:${details.userId || ''}`, Date.now())) return;
  recordAudit({
    userId: details.userId || null,
    subjectUserId: details.userId || null,
    actionType,
    entityType: 'auth_token',
    outcome: AUDIT_OUTCOMES.DENIED,
    newValues: {
      reason: details.reason || null,
      method: String(req.method || '').toUpperCase(),
      path: safePath(req),
    },
  }).catch(() => {});
}

/**
 * @param {import('express').Request} req
 * @param {{ requiredRoles?: string[] }} [details]
 */
function recordPermissionDenied(req, details = {}) {
  const userId = req.user?.userId || null;
  const path = safePath(req);
  if (!shouldRecord(`PERMISSION_DENIED:${userId || req.ip}:${req.method}:${path}`, Date.now())) return;
  recordAudit({
    userId,
    actionType: 'PERMISSION_DENIED',
    entityType: 'route',
    outcome: AUDIT_OUTCOMES.DENIED,
    newValues: {
      method: String(req.method || '').toUpperCase(),
      path,
      requiredRoles: Array.isArray(details.requiredRoles) ? details.requiredRoles.slice(0, 10) : undefined,
    },
  }).catch(() => {});
}

function resetSecurityEventDedupeForTests() {
  seen.clear();
}

module.exports = { recordTokenFailure, recordPermissionDenied, resetSecurityEventDedupeForTests };
