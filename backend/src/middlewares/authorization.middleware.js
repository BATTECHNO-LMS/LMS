const { filterDeprecatedFromRoleAllowlist } = require('../utils/runtimeRoles');
const { normalizeRoleCodes } = require('../utils/roleCanon');

/**
 * Require the authenticated user (`req.user` from authenticate) to have at least one
 * of the given `roles.code` values (case-insensitive).
 * Legacy codes in allowlists are canonicalized (e.g. university_admin → admin).
 * @param {...string} allowedRoleCodes
 */
function authorizeRoles(...allowedRoleCodes) {
  const normalized = filterDeprecatedFromRoleAllowlist(
    allowedRoleCodes.flat().filter(Boolean),
    'authorizeRoles'
  );
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    /** JWT marks super-admin scope; allow all role-gated admin routes regardless of misconfigured env CSVs. */
    if (req.user.isGlobal) {
      return next();
    }
    const userRoles = normalizeRoleCodes(
      Array.isArray(req.user.roles) ? req.user.roles : []
    );
    const ok = userRoles.some((r) => normalized.includes(r));
    if (!ok) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { authorizeRoles };
