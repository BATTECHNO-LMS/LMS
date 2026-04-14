const { prisma } = require('../../config/db');

function normalizeType(type) {
  const allowed = new Set(['info', 'success', 'warning', 'danger', 'system']);
  return allowed.has(type) ? type : 'info';
}

async function createNotificationForUser(payload) {
  if (!payload?.userId) return null;

  if (payload.dedupeWindowHours && payload.dedupeWindowHours > 0) {
    const since = new Date(Date.now() - payload.dedupeWindowHours * 3600 * 1000);
    const existing = await prisma.notifications.findFirst({
      where: {
        user_id: payload.userId,
        title: payload.title,
        created_at: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return null;
  }

  return prisma.notifications.create({
    data: {
      user_id: payload.userId,
      title: payload.title,
      body: payload.body ?? null,
      type: normalizeType(payload.type),
    },
  });
}

async function createNotificationsForUsers(payload) {
  const uniqueUserIds = [...new Set((payload?.userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length) return { created_count: 0 };
  let created = 0;
  for (const userId of uniqueUserIds) {
    const row = await createNotificationForUser({
      userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      dedupeWindowHours: payload.dedupeWindowHours,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function userIdsByRoleCodes(roleCodes, { universityId } = {}) {
  const codes = [...new Set((roleCodes || []).map((r) => String(r).toLowerCase()).filter(Boolean))];
  if (!codes.length) return [];
  const roles = await prisma.roles.findMany({
    where: { code: { in: codes } },
    select: { id: true },
  });
  if (!roles.length) return [];
  const roleIds = roles.map((r) => r.id);
  const userRoles = await prisma.user_roles.findMany({
    where: { role_id: { in: roleIds } },
    select: { user_id: true },
  });
  const userIds = [...new Set(userRoles.map((r) => r.user_id))];
  if (!userIds.length) return [];
  const users = await prisma.users.findMany({
    where: {
      id: { in: userIds },
      ...(universityId ? { primary_university_id: universityId } : {}),
      status: 'active',
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

module.exports = {
  createNotificationForUser,
  createNotificationsForUsers,
  userIdsByRoleCodes,
};
