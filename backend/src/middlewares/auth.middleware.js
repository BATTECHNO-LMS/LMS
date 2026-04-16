const { verifyToken } = require('../utils/jwt');
const { env } = require('../config/env');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const superCode = String(env.SUPER_ADMIN_ROLE_CODE || 'super_admin').toLowerCase();
    const hasSuperAdminRole = roles.some((r) => String(r).toLowerCase() === superCode);
    req.user = {
      userId: payload.userId,
      roles,
      universityId: payload.universityId ?? null,
      /** Tokens minted before `isGlobal` existed still carry the role list — treat as global. */
      isGlobal: Boolean(payload.isGlobal) || hasSuperAdminRole,
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
