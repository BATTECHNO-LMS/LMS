'use strict';

const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiError');
const { loadCurrentAuthContext } = require('../modules/auth/currentAuthContext');

/**
 * Verify JWT, then build req.user from current database authorization state.
 * Token roles / universityId / isGlobal are not authoritative.
 */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID',
    });
  }

  const userId = payload && payload.userId;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID',
    });
  }

  try {
    req.user = await loadCurrentAuthContext(userId);
    return next();
  } catch (err) {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code || 'API_ERROR',
      });
    }
    // Infrastructure / unexpected DB failure — do not treat as bad credentials
    // and do not fall back to stale JWT claims.
    return next(err);
  }
}

/** Alias for `authMiddleware` — same JWT verification + current-state identity. */
const authenticate = authMiddleware;

module.exports = { authMiddleware, authenticate };
