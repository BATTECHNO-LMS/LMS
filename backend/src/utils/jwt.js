const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

function getSecret() {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'battechno-dev-only-change-me';
}

/**
 * Token lifetime. Session-bound tokens (with `sid`) live exactly as long as the
 * server-side session's absolute cap; the server session is authoritative either way.
 */
function resolveExpiresIn(payload) {
  if (payload.sessionId) return `${env.AUTH_SESSION_ABSOLUTE_TIMEOUT_HOURS}h`;
  return env.JWT_EXPIRES_IN;
}

/**
 * @param {{
 *   userId: string
 *   roles: string[]
 *   universityId: string | null
 *   isGlobal: boolean
 *   portalType?: 'UNIVERSITY' | 'INSTITUTION' | null
 *   sessionId?: string   auth_sessions.id → `sid` claim (required by authenticate)
 * }} payload
 */
function signToken(payload) {
  const claims = {
    userId: payload.userId,
    roles: payload.roles,
    universityId: payload.universityId ?? null,
    isGlobal: Boolean(payload.isGlobal),
    portalType: payload.portalType === 'UNIVERSITY' || payload.portalType === 'INSTITUTION'
      ? payload.portalType
      : null,
  };
  if (payload.sessionId) claims.sid = payload.sessionId;
  return jwt.sign(claims, getSecret(), { expiresIn: resolveExpiresIn(payload) });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
