const { prisma } = require('../../config/db');

async function findUniversityById(id) {
  return prisma.universities.findFirst({
    where: { id, status: 'active' },
    select: { id: true, name: true, status: true },
  });
}

async function findActiveEmailDomainsForUniversity(universityId) {
  return prisma.university_email_domains.findMany({
    where: { university_id: universityId, is_active: true },
    select: { domain: true },
  });
}

async function findUserByEmail(email) {
  return prisma.users.findUnique({
    where: { email },
    select: {
      id: true,
      full_name: true,
      email: true,
      password_hash: true,
      phone: true,
      status: true,
      primary_university_id: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
    },
  });
}

async function findUserById(id) {
  return prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      full_name: true,
      email: true,
      password_hash: true,
      phone: true,
      status: true,
      primary_university_id: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
    },
  });
}

async function findRoleByCode(code) {
  return prisma.roles.findFirst({
    where: { code },
  });
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
async function loadRolesAndPermissions(userId, tx = prisma) {
  const links = await tx.user_roles.findMany({
    where: { user_id: userId },
    select: { role_id: true },
  });
  const roleIds = links.map((l) => l.role_id);
  if (!roleIds.length) {
    return { roleRecords: [], permissionCodes: [] };
  }

  const roleRecords = await tx.roles.findMany({
    where: { id: { in: roleIds } },
  });

  const rp = await tx.role_permissions.findMany({
    where: { role_id: { in: roleIds } },
    select: { permission_id: true },
  });
  const permIds = [...new Set(rp.map((p) => p.permission_id))];
  const perms = permIds.length
    ? await tx.permissions.findMany({
        where: { id: { in: permIds } },
        select: { code: true },
      })
    : [];

  return {
    roleRecords,
    permissionCodes: perms.map((p) => p.code),
  };
}

async function createStudentUserTx(tx, { full_name, email, password_hash, phone, university_id, studentRoleId }) {
  const user = await tx.users.create({
    data: {
      full_name,
      email,
      password_hash,
      phone: phone ?? null,
      status: 'inactive',
      primary_university_id: university_id,
    },
    select: {
      id: true,
      full_name: true,
      email: true,
      password_hash: true,
      phone: true,
      status: true,
      primary_university_id: true,
      last_login_at: true,
      created_at: true,
      updated_at: true,
    },
  });

  await tx.user_roles.create({
    data: {
      user_id: user.id,
      role_id: studentRoleId,
    },
  });

  await tx.university_users.create({
    data: {
      university_id: university_id,
      user_id: user.id,
      relationship_type: 'student',
    },
  });

  return user;
}

async function createStudentUser(payload) {
  return prisma.$transaction((tx) => createStudentUserTx(tx, payload));
}

async function touchLastLogin(userId) {
  await prisma.users.update({
    where: { id: userId },
    data: { last_login_at: new Date() },
    select: { id: true },
  });
}

/** Minimal list for self-service registration (unauthenticated). */
async function findActiveUniversitiesForRegistration() {
  return prisma.universities.findMany({
    where: {
      status: 'active',
      university_email_domains: {
        some: { is_active: true },
      },
    },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { name: 'asc' },
  });
}

module.exports = {
  findUniversityById,
  findActiveEmailDomainsForUniversity,
  findUserByEmail,
  findUserById,
  findRoleByCode,
  loadRolesAndPermissions,
  createStudentUser,
  touchLastLogin,
  findActiveUniversitiesForRegistration,
};
