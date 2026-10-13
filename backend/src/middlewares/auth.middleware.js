'use strict';

const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiError');
const { loadCurrentAuthContext } = require('../modules/auth/currentAuthContext');
const { enforceAcademicReviewerReadOnly } = require('./permission.middleware');
const { AUTH_ERROR_CODES, messageForCode } = require('../utils/authErrorCatalog');
const authSessions = require('../modules/auth/authSession.service');
const { recordTokenFailure } = require('../modules/auth/authSecurityEvents');
const { updateRequestContext } = require('../shared/requestContext');

/**
 * Resolve Bearer token from Authorization header, or from access_token/token
 * query on GET (needed when the browser opens /uploads/... in a new tab).
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  if (String(req.method || 'GET').toUpperCase() === 'GET') {
    const q = req.query?.access_token || req.query?.token;
    if (typeof q === 'string' && q.trim()) return q.trim();
  }
  return null;
}

const ROLE_PRIORITY = ['super_admin', 'admin', 'reviewer', 'instructor', 'trainer', 'student', 'trainee'];

function primaryRole(roles) {
  if (!Array.isArray(roles) || !roles.length) return null;
  for (const role of ROLE_PRIORITY) if (roles.includes(role)) return role;
  return String(roles[0]);
}

function deny(res, code, messageCode = code) {
  return res.status(401).json({
    success: false,
    message: messageForCode(messageCode),
    code,
  });
}

/**
 * Verify JWT, validate the server-side session (`sid`), then build req.user from the
 * current database authorization state. Token roles / universityId / isGlobal are not
 * authoritative.
 *
 * Normal API traffic only refreshes presence (`last_seen_at`); it never extends the
 * idle timeout. Only POST /auth/session/activity records human activity.
 */
async function authMiddleware(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return deny(res, AUTH_ERROR_CODES.UNAUTHORIZED);
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      recordTokenFailure(req, 'TOKEN_EXPIRED', { reason: 'JWT_EXPIRED' });
      return deny(res, AUTH_ERROR_CODES.TOKEN_EXPIRED);
    }
    recordTokenFailure(req, 'TOKEN_INVALID', { reason: 'JWT_VERIFY_FAILED' });
    return deny(res, AUTH_ERROR_CODES.TOKEN_INVALID, AUTH_ERROR_CODES.UNAUTHORIZED);
  }

  const userId = payload && payload.userId;
  if (!userId || typeof userId !== 'string') {
    recordTokenFailure(req, 'TOKEN_INVALID', { reason: 'MISSING_SUBJECT' });
    return deny(res, AUTH_ERROR_CODES.TOKEN_INVALID, AUTH_ERROR_CODES.UNAUTHORIZED);
  }

  const portalType =
    payload.portalType === 'UNIVERSITY' || payload.portalType === 'INSTITUTION'
      ? payload.portalType
      : null;
  if (!portalType) {
    return deny(res, AUTH_ERROR_CODES.PORTAL_REQUIRED);
  }

  // Legacy tokens (issued before server-side sessions) carry no `sid` → fresh login required.
  const sid = typeof payload.sid === 'string' ? payload.sid : null;
  if (!sid) {
    return deny(res, AUTH_ERROR_CODES.SESSION_NOT_FOUND);
  }

  try {
    const verdict = await authSessions.validateSession({ sid, userId });
    if (!verdict.ok) {
      if (verdict.code === AUTH_ERROR_CODES.SESSION_NOT_FOUND) {
        recordTokenFailure(req, 'TOKEN_INVALID', { reason: 'SESSION_MISMATCH', userId });
      }
      return deny(res, verdict.code);
    }
    req.authSession = verdict.session;
    authSessions.notePresenceInBackground(verdict.session);

    req.user = await loadCurrentAuthContext(userId, { portalType });
    if (req.user && portalType) req.user.portalType = portalType;
    if (req.user) req.user.sessionId = sid;
    req.authContext = req.user;
    updateRequestContext({
      userId,
      sessionId: sid,
      actorRole: primaryRole(req.user?.roles),
      universityId: req.user?.universityId ?? null,
      organizationId: req.user?.organizationId ?? null,
    });
    return enforceAcademicReviewerReadOnly(req, res, next);
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code || 'API_ERROR',
      });
    }
    return next(err);
  }
}

const authenticate = authMiddleware;

module.exports = { authMiddleware, authenticate, extractBearerToken, primaryRole };
