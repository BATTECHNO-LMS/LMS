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
 * @param {{
 *   userId: string
 *   roles: string[]
 *   universityId: string | null
 *   isGlobal: boolean
 * }} payload
 */
function signToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      roles: payload.roles,
      universityId: payload.universityId ?? null,
      isGlobal: Boolean(payload.isGlobal),
    },
    getSecret(),
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
