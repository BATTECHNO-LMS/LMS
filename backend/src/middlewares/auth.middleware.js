const { verifyToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      universityId: payload.universityId ?? null,
      isGlobal: Boolean(payload.isGlobal),
    };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      code: 'TOKEN_INVALID',
    });
  }
}

/** Alias for `authMiddleware` — same JWT verification and `req.user` shape. */
const authenticate = authMiddleware;

module.exports = { authMiddleware, authenticate };
