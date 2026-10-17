const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

const JWT_ALGORITHM = 'HS256';

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
  if (Array.isArray(payload.amr)) claims.amr = payload.amr.filter((m) => typeof m === 'string').slice(0, 4);
  return jwt.sign(claims, getSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: resolveExpiresIn(payload),
    ...(env.JWT_ISSUER ? { issuer: env.JWT_ISSUER } : {}),
    ...(env.JWT_AUDIENCE ? { audience: env.JWT_AUDIENCE } : {}),
  });
}

/** Only HS256 is accepted (no `none`, no algorithm switching); iss/aud enforced when configured. */
function verifyToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: [JWT_ALGORITHM],
    ...(env.JWT_ISSUER ? { issuer: env.JWT_ISSUER } : {}),
    ...(env.JWT_AUDIENCE ? { audience: env.JWT_AUDIENCE } : {}),
  });
}

module.exports = { signToken, verifyToken };
