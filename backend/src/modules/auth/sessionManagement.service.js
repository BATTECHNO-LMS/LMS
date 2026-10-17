'use strict';

/**
 * Self-service "Security & sessions": a user lists and ends *their own* sessions only.
 * Ownership is enforced server-side from req.user; a foreign or unknown id is
 * indistinguishable (404) and the attempt is recorded as an authorization denial.
 */

const authSessions = require('./authSession.service');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { describeUserAgent, maskIpAddress } = require('../../shared/security/deviceLabel');
const { recordAuthorizationDenial } = require('../../shared/security/securityEvents');

const { SESSION_END_REASONS } = authSessions;

function presentOwnSession(row, currentSessionId, now = new Date()) {
  const verdict = authSessions.evaluateSession(row, now);
  const status = verdict.ok ? 'ACTIVE' : row.ended_at || row.is_active === false ? 'ENDED' : 'EXPIRED';
  const device = describeUserAgent(row.user_agent);
  return {
    id: row.id,
    isCurrent: row.id === currentSessionId,
    status,
    device: device.label,
    browser: device.browser,
    os: device.os,
    ipApprox: maskIpAddress(row.ip_address),
    portalType: row.portal_type || null,
    loginMethod: row.created_by_login_method || null,
    authenticationLevel: row.authentication_level || 'PASSWORD',
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    lastSeenAt: row.last_seen_at || null,
    endedAt: row.ended_at || null,
    endReason: row.end_reason || null,
  };
}

async function listOwnSessions({ userId, currentSessionId, now = new Date() }) {
  const rows = await authSessions.listSessionsForOwner(userId, { take: 30 });
  const sessions = rows.map((r) => presentOwnSession(r, currentSessionId, now));
  sessions.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  return { sessions, activeCount: sessions.filter((s) => s.status === 'ACTIVE').length };
}

/** End one of my sessions. Ending the current one is a normal logout. */
async function endOwnSession({ userId, currentSessionId, sessionId, req }) {
  const row = await authSessions.getSessionById(sessionId);
  if (!row || row.user_id !== userId) {
    if (row && req) {
      await recordAuthorizationDenial(req, { reason: 'SESSION_NOT_OWNED', entityType: 'auth_session', entityId: sessionId });
    }
    throw new ApiError(404, 'الجلسة غير موجودة.', null, 'SESSION_NOT_FOUND');
  }
  const isCurrent = row.id === currentSessionId;
  const ended = await authSessions.endSession(
    row,
    isCurrent ? SESSION_END_REASONS.USER_LOGOUT : SESSION_END_REASONS.USER_REVOKED,
    { actorUserId: userId, detectedBy: 'user' }
  );
  return { ended, endedCurrent: isCurrent };
}

/** End every other open session of mine with one semantic audit event. */
async function endOtherOwnSessions({ userId, currentSessionId }) {
  const count = await authSessions.revokeUserSessions(userId, SESSION_END_REASONS.USER_REVOKED_OTHER_SESSIONS, {
    actorUserId: userId,
    exceptSessionId: currentSessionId,
    detectedBy: 'user',
    audit: false,
  });
  await recordAudit({
    userId,
    subjectUserId: userId,
    sessionId: currentSessionId,
    actionType: 'AUTH_OTHER_SESSIONS_ENDED',
    entityType: 'auth_session',
    entityId: currentSessionId,
    newValues: { endReason: SESSION_END_REASONS.USER_REVOKED_OTHER_SESSIONS, sessionsEnded: count },
  });
  return { sessionsEnded: count };
}

module.exports = { presentOwnSession, listOwnSessions, endOwnSession, endOtherOwnSessions };
