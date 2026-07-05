const { prisma } = require('../../config/db');

async function findAllRoles() {
  return prisma.roles.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      scope: true,
      description: true,
      created_at: true,
      updated_at: true,
    },
  });
}

async function countUsersPerRole(roleIds) {
  if (!roleIds.length) return new Map();
  const links = await prisma.user_roles.groupBy({
    by: ['role_id'],
    where: { role_id: { in: roleIds } },
    _count: { role_id: true },
  });
  return new Map(links.map((l) => [l.role_id, l._count.role_id]));
}

async function findAllPermissions() {
  return prisma.permissions.findMany({
    orderBy: [{ module: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      module: true,
      description: true,
    },
  });
}

async function findRoleById(roleId) {
  return prisma.roles.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      name: true,
      code: true,
      scope: true,
      description: true,
      created_at: true,
      updated_at: true,
    },
  });
}

async function findPermissionCodesForRole(roleId) {
  const links = await prisma.role_permissions.findMany({
    where: { role_id: roleId },
    select: { permission_id: true },
  });
  if (!links.length) return [];
  const permIds = links.map((l) => l.permission_id);
  const perms = await prisma.permissions.findMany({
    where: { id: { in: permIds } },
    select: { code: true },
  });
  return perms.map((p) => p.code);
}

async function countTotalRolePermissionLinks() {
  return prisma.role_permissions.count();
}

async function countUsersWithRoles() {
  const rows = await prisma.user_roles.groupBy({
    by: ['user_id'],
  });
  return rows.length;
}

module.exports = {
  findAllRoles,
  countUsersPerRole,
  findAllPermissions,
  findRoleById,
  findPermissionCodesForRole,
  countTotalRolePermissionLinks,
  countUsersWithRoles,
};
