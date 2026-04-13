const { prisma } = require('../../config/db');

const userPublicSelect = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  status: true,
  primary_university_id: true,
  last_login_at: true,
  created_at: true,
  updated_at: true,
};

async function findUserIdsLinkedToUniversity(universityId) {
  const rows = await prisma.university_users.findMany({
    where: { university_id: universityId },
    select: { user_id: true },
  });
  return rows.map((r) => r.user_id);
}

async function buildListWhere({ status, university_id, search }) {
  const parts = [];

  if (status) {
    parts.push({ status });
  }

  if (search) {
    parts.push({
      OR: [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (university_id) {
    const memberIds = await findUserIdsLinkedToUniversity(university_id);
    const or = [{ primary_university_id: university_id }];
    if (memberIds.length) {
      or.push({ id: { in: memberIds } });
    }
    parts.push({ OR: or });
  }

  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

async function countMany(where) {
  return prisma.users.count({ where });
}

async function findManyForList(where, skip, take) {
  return prisma.users.findMany({
    where,
    skip,
    take,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      status: true,
      primary_university_id: true,
      last_login_at: true,
    },
  });
}

async function findRolesByIds(roleIds, tx = prisma) {
  if (!roleIds.length) return [];
  return tx.roles.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, code: true, name: true, scope: true },
  });
}

async function findRolesByCodes(codes, tx = prisma) {
  if (!codes.length) return [];
  return tx.roles.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, name: true, scope: true },
  });
}

async function findRoleLinksForUsers(userIds, tx = prisma) {
  if (!userIds.length) return [];
  return tx.user_roles.findMany({
    where: { user_id: { in: userIds } },
    select: { user_id: true, role_id: true },
  });
}

async function findUserById(id, tx = prisma) {
  return tx.users.findUnique({
    where: { id },
    select: userPublicSelect,
  });
}

async function findUserWithSecretById(id, tx = prisma) {
  return tx.users.findUnique({ where: { id } });
}

async function findUserByEmail(email, tx = prisma) {
  return tx.users.findUnique({
    where: { email },
    select: { id: true },
  });
}

async function findUniversityById(id, tx = prisma) {
  return tx.universities.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      partnership_state: true,
      contact_email: true,
      contact_phone: true,
      contact_person: true,
    },
  });
}

async function findUniversityMembershipsForUser(userId, tx = prisma) {
  return tx.university_users.findMany({
    where: { user_id: userId },
    select: {
      id: true,
      university_id: true,
      relationship_type: true,
      created_at: true,
    },
  });
}

async function createUser(data, tx) {
  return tx.users.create({
    data,
    select: userPublicSelect,
  });
}

async function createUserRoleLinks(userId, roleIds, tx) {
  const data = roleIds.map((role_id) => ({ user_id: userId, role_id }));
  await tx.user_roles.createMany({ data });
}

async function upsertUniversityUser({ university_id, user_id, relationship_type }, tx) {
  const existing = await tx.university_users.findFirst({
    where: { university_id, user_id },
    select: { id: true },
  });
  if (existing) {
    await tx.university_users.update({
      where: { id: existing.id },
      data: { relationship_type, updated_at: new Date() },
    });
  } else {
    await tx.university_users.create({
      data: { university_id, user_id, relationship_type },
    });
  }
}

async function deleteAllUserRoles(userId, tx) {
  await tx.user_roles.deleteMany({ where: { user_id: userId } });
}

async function updateUser(id, data, tx = prisma) {
  return tx.users.update({
    where: { id },
    data,
    select: userPublicSelect,
  });
}

module.exports = {
  buildListWhere,
  countMany,
  findManyForList,
  findRolesByIds,
  findRolesByCodes,
  findRoleLinksForUsers,
  findUserById,
  findUserWithSecretById,
  findUserByEmail,
  findUniversityById,
  findUniversityMembershipsForUser,
  createUser,
  createUserRoleLinks,
  upsertUniversityUser,
  deleteAllUserRoles,
  updateUser,
};
