const { prisma } = require('../../config/db');

const userPublicSelect = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  status: true,
  primary_university_id: true,
  university_specialty_id: true,
  specialty_id: true,
  activated_at: true,
  email_verified_at: true,
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

async function buildListWhere({ status, university_id, search, email_verified }) {
  const parts = [];

  if (status) {
    parts.push({ status });
  }

  if (email_verified === true) {
    parts.push({ email_verified_at: { not: null } });
  } else if (email_verified === false) {
    parts.push({ email_verified_at: null });
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
      university_specialty_id: true,
      specialty_id: true,
      activated_at: true,
      email_verified_at: true,
      last_login_at: true,
      created_at: true,
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

/** Inactive users with the student role, optionally scoped to a university. */
async function findInactiveStudents({ studentRoleId, university_id }) {
  const roleLinks = await prisma.user_roles.findMany({
    where: { role_id: studentRoleId },
    select: { user_id: true },
  });
  const studentUserIds = roleLinks.map((r) => r.user_id);
  if (!studentUserIds.length) return [];

  const base = {
    id: { in: studentUserIds },
    status: 'inactive',
  };

  if (!university_id) {
    return prisma.users.findMany({
      where: base,
      select: { id: true, email: true, full_name: true },
      orderBy: { created_at: 'asc' },
    });
  }

  const memberIds = await findUserIdsLinkedToUniversity(university_id);
  const scopeOr = [{ primary_university_id: university_id }];
  if (memberIds.length) scopeOr.push({ id: { in: memberIds } });

  return prisma.users.findMany({
    where: { AND: [base, { OR: scopeOr }] },
    select: { id: true, email: true, full_name: true },
    orderBy: { created_at: 'asc' },
  });
}

async function findUniversitySpecialtyById(id, tx = prisma) {
  if (!id) return null;
  return tx.university_specialties.findUnique({
    where: { id },
    select: {
      id: true,
      university_id: true,
      specialty_id: true,
      name_ar: true,
      name_en: true,
      code: true,
      college_name_ar: true,
      college_name_en: true,
      status: true,
    },
  });
}

async function findSpecialtyById(id, tx = prisma) {
  if (!id) return null;
  return tx.specialties.findUnique({
    where: { id },
    select: {
      id: true,
      name_ar: true,
      name_en: true,
      code: true,
      status: true,
    },
  });
}

async function findUniversitiesByIds(ids, tx = prisma) {
  if (!ids.length) return [];
  return tx.universities.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, type: true, status: true },
  });
}

async function findUniversitySpecialtiesByIds(ids, tx = prisma) {
  if (!ids.length) return [];
  return tx.university_specialties.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      university_id: true,
      specialty_id: true,
      name_ar: true,
      name_en: true,
      code: true,
      college_name_ar: true,
      college_name_en: true,
      status: true,
    },
  });
}

/**
 * Unpaginated export select — no secrets / OTP / password fields.
 */
async function findManyForExport(where) {
  return prisma.users.findMany({
    where,
    orderBy: [{ full_name: 'asc' }],
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      status: true,
      primary_university_id: true,
      university_specialty_id: true,
      specialty_id: true,
      email_verified_at: true,
      last_login_at: true,
      created_at: true,
    },
  });
}

async function findUserIdsByRoleCode(roleCode) {
  if (!roleCode) return null;
  const role = await prisma.roles.findFirst({
    where: { code: String(roleCode).trim().toLowerCase() },
    select: { id: true },
  });
  if (!role) return [];
  const links = await prisma.user_roles.findMany({
    where: { role_id: role.id },
    select: { user_id: true },
  });
  return links.map((l) => l.user_id);
}

async function findExporterName(userId) {
  if (!userId) return null;
  const u = await prisma.users.findUnique({
    where: { id: userId },
    select: { full_name: true, email: true },
  });
  return u?.full_name || u?.email || null;
}

async function findSpecialtiesByIds(ids, tx = prisma) {
  if (!ids.length) return [];
  return tx.specialties.findMany({
    where: { id: { in: ids } },
    select: { id: true, name_ar: true, name_en: true, code: true, status: true },
  });
}

async function findRecentAuditForUser(userId, take = 20) {
  return prisma.audit_logs.findMany({
    where: {
      OR: [{ entity_type: 'user', entity_id: userId }, { user_id: userId }],
    },
    orderBy: { created_at: 'desc' },
    take,
    select: {
      id: true,
      action_type: true,
      entity_type: true,
      entity_id: true,
      created_at: true,
      user_id: true,
    },
  });
}

async function countUserActivity(userId) {
  const [enrollments, courseEnrollments, fieldTrainings, certificates] = await Promise.all([
    prisma.enrollments.count({ where: { student_id: userId } }).catch(() => 0),
    prisma.course_enrollments.count({ where: { student_id: userId } }).catch(() => 0),
    prisma.field_training_applications.count({ where: { student_id: userId } }).catch(() => 0),
    prisma.certificates.count({ where: { student_id: userId } }).catch(() => 0),
  ]);
  return {
    enrollments_count: enrollments,
    course_enrollments_count: courseEnrollments,
    field_training_applications_count: fieldTrainings,
    certificates_count: certificates,
  };
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
  findUniversitySpecialtyById,
  findSpecialtyById,
  findUniversitiesByIds,
  findUniversitySpecialtiesByIds,
  findSpecialtiesByIds,
  findRecentAuditForUser,
  countUserActivity,
  findManyForExport,
  findUserIdsByRoleCode,
  findExporterName,
  createUser,
  createUserRoleLinks,
  upsertUniversityUser,
  deleteAllUserRoles,
  updateUser,
  findInactiveStudents,
};
