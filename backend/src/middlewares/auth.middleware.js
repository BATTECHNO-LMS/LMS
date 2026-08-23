'use strict';

const { verifyToken } = require('../utils/jwt');
const { ApiError } = require('../utils/apiError');
const { loadCurrentAuthContext } = require('../modules/auth/currentAuthContext');
const { enforceAcademicReviewerReadOnly } = require('./permission.middleware');
const { AUTH_ERROR_CODES, messageForCode } = require('../utils/authErrorCatalog');

/**
 * Verify JWT, then build req.user from current database authorization state.
 * Token roles / universityId / isGlobal are not authoritative.
 */
async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED),
      code: AUTH_ERROR_CODES.UNAUTHORIZED,
    });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({
      success: false,
      message: messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED),
      code: 'TOKEN_INVALID',
    });
  }

  const userId = payload && payload.userId;
  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({
      success: false,
      message: messageForCode(AUTH_ERROR_CODES.UNAUTHORIZED),
      code: 'TOKEN_INVALID',
    });
  }

  const portalType =
    payload.portalType === 'UNIVERSITY' || payload.portalType === 'INSTITUTION'
      ? payload.portalType
      : null;
  if (!portalType) {
    return res.status(401).json({
      success: false,
      message: messageForCode(AUTH_ERROR_CODES.PORTAL_REQUIRED),
      code: AUTH_ERROR_CODES.PORTAL_REQUIRED,
    });
  }

  try {
    req.user = await loadCurrentAuthContext(userId, { portalType });
    if (req.user && portalType) req.user.portalType = portalType;
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

module.exports = { authMiddleware, authenticate };
