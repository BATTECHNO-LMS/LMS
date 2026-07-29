'use strict';

const { normalizeRoleCodes } = require('../utils/roleCanon');

/**
 * Require one of the given roles on `req.user` (set by authMiddleware).
 * Checks `roles` array (and primary `role`) after canonicalization.
 * @param {...string} roles
 */
function requireRoles(...roles) {
  const allowed = normalizeRoleCodes(roles.flat().filter(Boolean));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'يجب تسجيل الدخول للمتابعة.',
        code: 'UNAUTHORIZED',
      });
    }
    if (req.user.isGlobal) return next();

    const userRoles = normalizeRoleCodes([
      ...(Array.isArray(req.user.roles) ? req.user.roles : []),
      req.user.role,
    ].filter(Boolean));

    const ok = userRoles.some((r) => allowed.includes(r));
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: 'لا تملك صلاحية تنفيذ هذه العملية.',
        code: 'FORBIDDEN',
      });
    }
    return next();
  };
}

module.exports = { requireRoles };
