const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const repo = require('./roles.repository');
const {
  CANONICAL_ROLE_CODES,
  CANONICAL_ROLE_SET,
  canonicalizeRoleCode,
  ROLE_META,
} = require('../../utils/roleCanon');
const {
  MODULES,
  ACTIONS,
  ALL_PERMISSION_CODES,
  SUPER_ADMIN_LOCKED_CODES,
  isWritePermissionCode,
  reviewerAllowedCodes,
} = require('../../utils/permissionCatalog');
const { prisma } = require('../../config/db');

async function listRolesOverview() {
  const [roles, permissions, totalLinks, linkedUsers] = await Promise.all([
    repo.findAllRoles(),
    repo.findAllPermissions(),
    repo.countTotalRolePermissionLinks(),
    repo.countUsersWithRoles(),
  ]);

  const userCounts = await repo.countUsersPerRole(roles.map((r) => r.id));

  const rolesWithCounts = await Promise.all(
    roles.map(async (role) => {
      const permission_codes = await repo.findPermissionCodesForRole(role.id);
      const code = String(role.code || '').toLowerCase();
      const canonical = canonicalizeRoleCode(code);
      return {
        ...role,
        name_ar: ROLE_META[canonical]?.name_ar || role.name,
        is_canonical: CANONICAL_ROLE_SET.has(code),
        assignable: Boolean(ROLE_META[code]?.assignable) || code === 'super_admin',
        users_count: userCounts.get(role.id) ?? 0,
        permissions_count: permission_codes.length,
        permission_codes,
      };
    })
  );

  const activeRoles = rolesWithCounts
    .filter((r) => r.is_canonical)
    .sort(
      (a, b) => CANONICAL_ROLE_CODES.indexOf(a.code) - CANONICAL_ROLE_CODES.indexOf(b.code)
    );

  return {
    roles: activeRoles,
    permissions,
    modules: MODULES,
    actions: ACTIONS,
    matrix: Object.fromEntries(activeRoles.map((r) => [r.code, r.permission_codes])),
    summary: {
      roles_count: activeRoles.length,
      permissions_count: permissions.length,
      role_permission_links: totalLinks,
      users_with_roles: linkedUsers,
    },
  };
}

async function getRoleDetail(roleId) {
  const role = await repo.findRoleById(roleId);
  if (!role) throw new ApiError(404, 'Role not found');
  const permission_codes = await repo.findPermissionCodesForRole(roleId);
  const userCounts = await repo.countUsersPerRole([roleId]);
  return {
    role: {
      ...role,
      users_count: userCounts.get(roleId) ?? 0,
      permission_codes,
    },
  };
}

/**
 * Replace permission codes for a canonical role (super_admin only via route).
 */
async function updateRolePermissions(roleIdOrCode, permissionCodes, actor = {}, meta = {}) {
  const raw = String(roleIdOrCode || '').trim();
  let role = null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    role = await repo.findRoleById(raw);
  }
  if (!role) {
    role = await repo.findRoleByCode(canonicalizeRoleCode(raw) || raw.toLowerCase());
  }
  if (!role) throw new ApiError(404, 'Role not found');

  const roleCode = String(role.code).toLowerCase();
  if (!CANONICAL_ROLE_SET.has(roleCode)) {
    throw new ApiError(400, 'Only canonical roles can be edited', null, 'ROLE_NOT_EDITABLE');
  }

  let nextCodes = [...new Set((permissionCodes || []).map((c) => String(c).toLowerCase()))];

  const unknown = nextCodes.filter((c) => !ALL_PERMISSION_CODES.includes(c));
  if (unknown.length) {
    throw new ApiError(400, `Unknown permission codes: ${unknown.join(', ')}`, { unknown });
  }

  if (roleCode === 'super_admin') {
    // Always keep full locked set — cannot strip core super_admin powers.
    nextCodes = [...SUPER_ADMIN_LOCKED_CODES];
  }

  if (roleCode === 'academic_reviewer') {
    const allowed = new Set(reviewerAllowedCodes());
    const illegal = nextCodes.filter((c) => !allowed.has(c) || isWritePermissionCode(c));
    if (illegal.length) {
      throw new ApiError(
        400,
        'Academic reviewer may only receive view/export permissions',
        { illegal },
        'REVIEWER_WRITE_FORBIDDEN'
      );
    }
    nextCodes = nextCodes.filter((c) => allowed.has(c));
  }

  const oldCodes = await repo.findPermissionCodesForRole(role.id);
  const permRows = await repo.findPermissionIdsByCodes(nextCodes);
  if (permRows.length !== nextCodes.length) {
    throw new ApiError(400, 'Some permission codes are missing from the catalog');
  }

  await prisma.$transaction(async (tx) => {
    await repo.replaceRolePermissions(
      role.id,
      permRows.map((p) => p.id),
      tx
    );
  });

  await recordAudit({
    userId: meta.actorUserId ?? actor.userId ?? null,
    universityId: actor.universityId ?? null,
    actionType: 'ROLE_PERMISSIONS_UPDATED',
    entityType: 'role',
    entityId: role.id,
    oldValues: { code: roleCode, permission_codes: oldCodes },
    newValues: { code: roleCode, permission_codes: nextCodes },
    ipAddress: meta.ipAddress ?? null,
  });

  const permission_codes = await repo.findPermissionCodesForRole(role.id);
  return {
    role: {
      ...role,
      permission_codes,
      permissions_count: permission_codes.length,
    },
  };
}

module.exports = { listRolesOverview, getRoleDetail, updateRolePermissions };
