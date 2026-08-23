'use strict';

/**
 * Short-TTL cache of role_id to permission codes (catalog data, not user-specific).
 */

const TTL_MS = 60_000;

let expiresAt = 0;
let byRoleId = new Map();

function resetIfStale() {
  if (Date.now() > expiresAt) {
    byRoleId = new Map();
    expiresAt = Date.now() + TTL_MS;
  }
}

function clearRolePermissionCache() {
  expiresAt = 0;
  byRoleId = new Map();
}

async function getPermissionCodesForRoleIds(prisma, roleIds) {
  const ids = [...new Set((roleIds || []).filter(Boolean))];
  if (!ids.length) return [];

  resetIfStale();
  const missing = ids.filter((id) => !byRoleId.has(id));
  if (missing.length) {
    const links = await prisma.role_permissions.findMany({
      where: { role_id: { in: missing } },
      select: { role_id: true, permission_id: true },
    });
    const permIds = [...new Set(links.map((l) => l.permission_id))];
    const perms = permIds.length
      ? await prisma.permissions.findMany({
          where: { id: { in: permIds } },
          select: { id: true, code: true },
        })
      : [];
    const codeById = new Map(perms.map((p) => [p.id, p.code]));
    const grouped = new Map(missing.map((id) => [id, []]));
    for (const link of links) {
      const code = codeById.get(link.permission_id);
      if (code) grouped.get(link.role_id).push(code);
    }
    for (const [id, codes] of grouped) {
      byRoleId.set(id, [...new Set(codes)]);
    }
  }

  const out = new Set();
  for (const id of ids) {
    for (const code of byRoleId.get(id) || []) out.add(code);
  }
  return [...out];
}

module.exports = {
  TTL_MS,
  getPermissionCodesForRoleIds,
  getPermissionCodesForRoleIds: getPermissionCodesForRoleIds,
  clearRolePermissionCache,
};