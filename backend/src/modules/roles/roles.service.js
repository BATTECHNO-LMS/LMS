const { ApiError } = require('../../utils/apiError');
const repo = require('./roles.repository');

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
      return {
        ...role,
        users_count: userCounts.get(role.id) ?? 0,
        permissions_count: permission_codes.length,
        permission_codes,
      };
    })
  );

  return {
    roles: rolesWithCounts,
    permissions,
    summary: {
      roles_count: roles.length,
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

module.exports = { listRolesOverview, getRoleDetail };
