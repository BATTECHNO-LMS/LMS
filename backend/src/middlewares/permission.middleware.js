'use strict';

const { normalizeRoleCodes } = require('../utils/roleCanon');
const { isWritePermissionCode } = require('../utils/permissionCatalog');

/**
 * Require at least one of the given permission codes on req.user.permissions.
 * Super Admin (isGlobal) bypasses. Reviewer never passes write codes.
 * @param {...string} permissionCodes
 */
function requirePermission(...permissionCodes) {
  const needed = permissionCodes.map((c) => String(c).toLowerCase()).filter(Boolean);
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    if (req.user.isGlobal) return next();

    const roles = normalizeRoleCodes(req.user.roles || []);
    const isReviewerScoped =
      roles.includes('reviewer') &&
      !roles.includes('super_admin') &&
      !roles.includes('admin');

    if (isReviewerScoped && needed.some(isWritePermissionCode)) {
      return res.status(403).json({
        success: false,
        message: 'Reviewer is read-only',
        code: 'REVIEWER_READ_ONLY',
      });
    }

    const have = new Set(
      (Array.isArray(req.user.permissions) ? req.user.permissions : []).map((p) =>
        String(p).toLowerCase()
      )
    );
    if (have.has('*') || have.has('ui.all')) return next();
    const ok = needed.some((code) => have.has(code));
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Forbidden', code: 'FORBIDDEN' });
    }
    return next();
  };
}

/**
 * Hard fail-closed: reviewer without admin/super_admin cannot mutate.
 * Exceptions: own notification read marks; student self-service routes if also student.
 */
function enforceReviewerReadOnly(req, res, next) {
  if (!req.user) return next();

  const roles = normalizeRoleCodes(req.user.roles || []);
  if (!roles.includes('reviewer')) return next();
  if (roles.includes('super_admin') || roles.includes('admin')) return next();

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const path = String(req.originalUrl || req.url || '').toLowerCase();
  if (path.includes('/notifications/') || path.endsWith('/notifications') || path.includes('/notifications?')) {
    if (method === 'PATCH' || method === 'PUT') return next();
  }
  if (roles.includes('student') && path.includes('/student/')) return next();

  return res.status(403).json({
    success: false,
    message: 'Reviewer is read-only',
    code: 'REVIEWER_READ_ONLY',
  });
}

/** @deprecated alias — use enforceReviewerReadOnly */
const enforceAcademicReviewerReadOnly = enforceReviewerReadOnly;

module.exports = {
  requirePermission,
  enforceReviewerReadOnly,
  enforceAcademicReviewerReadOnly,
};
