const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { hashPassword } = require('../../utils/password');
const { ensureUserLinkedToUniversityFromEmail } = require('../auth/universityEmailLink.service');
const {
  resolveUniversityIdFilter,
  assertUniversityRecordAccess,
  isSystemWideAdmin,
} = require('../../utils/universityScope');
const { prisma } = require('../../config/db');
const usersRepository = require('./users.repository');
const { recordAudit } = require('../../utils/auditRecorder');
const { buildUsersExportWorkbook } = require('./users.export.excel');
const {
  assertSuperAdminRoleMutationAllowed,
  assertSuperAdminAdministrativeControlAllowed,
} = require('./superAdminPrivilegeBoundary');
const { assertProgramAdminNotNewlyAssigned } = require('./programAdminAssignmentGuard');
const { canonicalizeRoleCode, normalizeRoleCodes, ASSIGNABLE_ROLE_CODES, pickPrimaryRoleCode, CANONICAL_ROLE_CODES } = require('../../utils/roleCanon');

/** Roles that require a primary university assignment. */
const UNIVERSITY_SCOPED_ROLES = new Set([
  'student',
  'instructor',
  'admin',
  'academic_reviewer',
]);

function normalizeAssignedRoleCodes(roleCodes) {
  const normalized = normalizeRoleCodes(roleCodes);
  if (!normalized.length) {
    throw new ApiError(400, 'يجب اختيار دور واحد على الأقل', null, 'ROLE_REQUIRED');
  }
  const primary = pickPrimaryRoleCode(normalized);
  return [primary || normalized[0]];
}

function relationshipTypeForRoles(roleCodes = []) {
  const codes = normalizeRoleCodes(roleCodes);
  if (codes.includes('student')) return 'student';
  if (codes.includes('instructor')) return 'instructor';
  if (codes.includes('academic_reviewer')) return 'reviewer';
  return 'staff';
}

function rolesRequireUniversity(roleCodes = []) {
  return normalizeRoleCodes(roleCodes).some((c) =>
    ['student', 'instructor', 'admin', 'academic_reviewer'].includes(c)
  );
}

function rolesIncludeStudent(roleCodes = []) {
  return normalizeRoleCodes(roleCodes).includes('student');
}

async function resolveSpecialtyFields({
  primaryUniversityId,
  universitySpecialtyId,
  specialtyId,
  roleCodes,
  requireStudentSpecialty = false,
}) {
  const isStudent = rolesIncludeStudent(roleCodes);
  let nextUniSpecialtyId = universitySpecialtyId;
  let nextSpecialtyId = specialtyId;

  if (!isStudent) {
    // Non-students must not carry academic specialty links from the create/update form.
    if (universitySpecialtyId !== undefined) nextUniSpecialtyId = null;
    if (specialtyId !== undefined) nextSpecialtyId = null;
    return { university_specialty_id: nextUniSpecialtyId, specialty_id: nextSpecialtyId };
  }

  if (requireStudentSpecialty && !nextUniSpecialtyId) {
    throw new ApiError(400, 'تخصص الجامعة مطلوب للطالب', null, 'UNIVERSITY_SPECIALTY_REQUIRED');
  }

  if (nextUniSpecialtyId) {
    if (!primaryUniversityId) {
      throw new ApiError(400, 'يجب اختيار الجامعة قبل التخصص', null, 'UNIVERSITY_REQUIRED');
    }
    const us = await usersRepository.findUniversitySpecialtyById(nextUniSpecialtyId);
    if (!us || us.status === 'inactive') {
      throw new ApiError(400, 'تخصص الجامعة غير موجود أو غير فعّال', null, 'UNIVERSITY_SPECIALTY_NOT_FOUND');
    }
    if (String(us.university_id) !== String(primaryUniversityId)) {
      throw new ApiError(
        400,
        'التخصص المحدد لا يتبع الجامعة المختارة',
        null,
        'UNIVERSITY_SPECIALTY_MISMATCH'
      );
    }
    if (specialtyId === undefined || specialtyId === null) {
      nextSpecialtyId = us.specialty_id || null;
    }
  }

  if (nextSpecialtyId) {
    const sp = await usersRepository.findSpecialtyById(nextSpecialtyId);
    if (!sp) throw new ApiError(400, 'التخصص المرجعي غير موجود', null, 'SPECIALTY_NOT_FOUND');
  }

  return {
    university_specialty_id: nextUniSpecialtyId ?? null,
    specialty_id: nextSpecialtyId ?? null,
  };
}

async function loadUserRoleCodes(userId) {
  const links = await usersRepository.findRoleLinksForUsers([userId]);
  const roleIds = [...new Set(links.map((l) => l.role_id))];
  if (!roleIds.length) return [];
  const roles = await usersRepository.findRolesByIds(roleIds);
  return roles.map((r) => r.code);
}

async function assertUserAccessible(requester, user) {
  if (isSystemWideAdmin(requester)) return;
  const uni = resolveUniversityIdFilter(requester, null);
  if (!uni) {
    throw new ApiError(403, 'Forbidden');
  }
  if (user.primary_university_id && String(user.primary_university_id) === String(uni)) return;
  const memberships = await usersRepository.findUniversityMembershipsForUser(user.id);
  if (memberships.some((m) => String(m.university_id) === String(uni))) return;
  throw new ApiError(403, 'Forbidden');
}

async function mapUsersWithRoles(userRows) {
  const ids = userRows.map((u) => u.id);
  const links = await usersRepository.findRoleLinksForUsers(ids);
  const roleIds = [...new Set(links.map((l) => l.role_id))];
  const roles = await usersRepository.findRolesByIds(roleIds);
  const codeByRoleId = new Map(roles.map((r) => [r.id, r.code]));
  const rolesByUser = new Map();
  for (const link of links) {
    const code = codeByRoleId.get(link.role_id);
    if (!code) continue;
    const list = rolesByUser.get(link.user_id) || [];
    list.push(code);
    rolesByUser.set(link.user_id, list);
  }
  return userRows.map((u) => {
    const normalized = normalizeRoleCodes(rolesByUser.get(u.id) || []);
    return {
      ...u,
      roles: normalized,
      role: pickPrimaryRoleCode(normalized),
    };
  });
}

async function listUsers(query, requester = {}) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, query.university_id);
  const where = await usersRepository.buildListWhere({
    status: query.status,
    university_id: scopedUniversityId,
    search: query.search,
    email_verified: query.email_verified,
  });
  if (!isSystemWideAdmin(requester) && !scopedUniversityId) {
    return {
      items: [],
      role_counts: Object.fromEntries(CANONICAL_ROLE_CODES.map((c) => [c, 0])),
      meta: { page: query.page, page_size: query.page_size, total: 0, total_pages: 1 },
    };
  }

  if (query.role) {
    const roleCode = canonicalizeRoleCode(query.role) || String(query.role).toLowerCase();
    const roleUserIds = await usersRepository.findUserIdsByRoleCode(roleCode);
    const idFilter = {
      id: { in: roleUserIds.length ? roleUserIds : ['00000000-0000-4000-8000-000000000000'] },
    };
    if (where.AND) {
      where.AND.push(idFilter);
    } else if (Object.keys(where).length) {
      where = { AND: [where, idFilter] };
    } else {
      where = idFilter;
    }
  }

  const page = query.page;
  const page_size = query.page_size;
  const skip = (page - 1) * page_size;

  const [total, rows, role_counts] = await Promise.all([
    usersRepository.countMany(where),
    usersRepository.findManyForList(where, skip, page_size),
    countUsersByCanonicalRole(scopedUniversityId, requester),
  ]);

  const items = await mapUsersWithRoles(rows);

  const uniIds = [...new Set(items.map((u) => u.primary_university_id).filter(Boolean))];
  const uspecIds = [...new Set(items.map((u) => u.university_specialty_id).filter(Boolean))];
  const specIds = [...new Set(items.map((u) => u.specialty_id).filter(Boolean))];
  const [unis, uspecs, specs] = await Promise.all([
    usersRepository.findUniversitiesByIds(uniIds),
    usersRepository.findUniversitySpecialtiesByIds(uspecIds),
    usersRepository.findSpecialtiesByIds(specIds),
  ]);
  const uniMap = new Map(unis.map((u) => [u.id, u]));
  const uspecMap = new Map(uspecs.map((s) => [s.id, s]));
  const specMap = new Map(specs.map((s) => [s.id, s]));

  const enriched = items.map((u) => ({
    ...u,
    primary_university: u.primary_university_id ? uniMap.get(u.primary_university_id) || null : null,
    university_specialty: u.university_specialty_id
      ? uspecMap.get(u.university_specialty_id) || null
      : null,
    specialty: u.specialty_id ? specMap.get(u.specialty_id) || null : null,
  }));

  const total_pages = Math.max(1, Math.ceil(total / page_size));

  return {
    items: enriched,
    role_counts,
    meta: {
      page,
      page_size,
      total,
      total_pages,
    },
  };
}

async function countUsersByCanonicalRole(scopedUniversityId, requester) {
  const counts = Object.fromEntries(CANONICAL_ROLE_CODES.map((c) => [c, 0]));
  for (const code of CANONICAL_ROLE_CODES) {
    const ids = await usersRepository.findUserIdsByRoleCode(code);
    if (!ids.length) continue;
    if (!scopedUniversityId || isSystemWideAdmin(requester)) {
      counts[code] = ids.length;
      continue;
    }
    const scoped = await prisma.users.count({
      where: {
        id: { in: ids },
        primary_university_id: scopedUniversityId,
      },
    });
    counts[code] = scoped;
  }
  return counts;
}

async function getUserById(id, requester = {}) {
  const user = await usersRepository.findUserById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, user);
  const [withRoles] = await mapUsersWithRoles([user]);
  const primaryUniversity = withRoles.primary_university_id
    ? await usersRepository.findUniversityById(withRoles.primary_university_id)
    : null;

  const memberships = await usersRepository.findUniversityMembershipsForUser(id);
  const uniIds = [...new Set(memberships.map((m) => m.university_id))];
  const universities = await Promise.all(uniIds.map((uid) => usersRepository.findUniversityById(uid)));
  const uniById = new Map(universities.filter(Boolean).map((u) => [u.id, u]));

  const university_relationships = memberships.map((m) => ({
    id: m.id,
    university_id: m.university_id,
    relationship_type: m.relationship_type,
    created_at: m.created_at,
    university: uniById.get(m.university_id) || null,
  }));

  const [uniSpec, globalSpec, activity, recentAudits] = await Promise.all([
    usersRepository.findUniversitySpecialtyById(withRoles.university_specialty_id),
    usersRepository.findSpecialtyById(withRoles.specialty_id),
    usersRepository.countUserActivity(id),
    usersRepository.findRecentAuditForUser(id, 25),
  ]);

  return {
    ...withRoles,
    primary_university: primaryUniversity,
    university_specialty: uniSpec,
    specialty: globalSpec,
    university_relationships,
    activity,
    recent_audits: recentAudits,
  };
}

async function createUser(body, requester = {}, meta = {}) {
  if (body.primary_university_id) {
    assertUniversityRecordAccess(requester, body.primary_university_id);
  } else if (!isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'تعيين الجامعة مطلوب', null, 'UNIVERSITY_REQUIRED');
  }

  const roleCodes = normalizeAssignedRoleCodes(body.role_codes);

  if (rolesRequireUniversity(roleCodes) && !body.primary_university_id) {
    throw new ApiError(400, 'تعيين الجامعة مطلوب لهذا الدور', null, 'UNIVERSITY_REQUIRED');
  }

  const existing = await usersRepository.findUserByEmail(body.email);
  if (existing) {
    throw new ApiError(409, 'البريد الإلكتروني مستخدم مسبقًا', null, 'EMAIL_EXISTS');
  }

  assertSuperAdminRoleMutationAllowed({
    requester,
    currentRoleCodes: [],
    requestedRoleCodes: roleCodes,
  });
  assertProgramAdminNotNewlyAssigned({ requestedRoleCodes: roleCodes });

  const roleRecords = await usersRepository.findRolesByCodes(roleCodes);
  const foundCodes = new Set(roleRecords.map((r) => r.code.toLowerCase()));
  const missing = roleCodes.filter((c) => !foundCodes.has(c.toLowerCase()));
  if (missing.length) {
    throw new ApiError(400, `رمز الدور غير معروف: ${missing.join(', ')}`);
  }

  if (body.primary_university_id) {
    const uni = await usersRepository.findUniversityById(body.primary_university_id);
    if (!uni) {
      throw new ApiError(404, 'الجامعة غير موجودة');
    }
  }

  const specialtyFields = await resolveSpecialtyFields({
    primaryUniversityId: body.primary_university_id,
    universitySpecialtyId: body.university_specialty_id,
    specialtyId: body.specialty_id,
    roleCodes,
    requireStudentSpecialty: rolesIncludeStudent(roleCodes),
  });

  const password_hash = await hashPassword(body.password);
  const status = body.status ?? 'inactive';
  const now = new Date();
  const emailVerified =
    body.email_verified === true ? true : body.email_verified === false ? false : false;
  // Activation and email verification are independent.
  const email_verified_at = emailVerified ? now : null;
  const activated_at = status === 'active' ? now : null;

  const relationshipType =
    body.university_relationship_type || relationshipTypeForRoles(roleCodes);

  const user = await prisma.$transaction(async (tx) => {
    const created = await usersRepository.createUser(
      {
        full_name: body.full_name,
        email: body.email,
        password_hash,
        phone: body.phone ?? null,
        status,
        primary_university_id: body.primary_university_id ?? null,
        university_specialty_id: specialtyFields.university_specialty_id,
        specialty_id: specialtyFields.specialty_id,
        email_verified_at,
        activated_at,
      },
      tx
    );

    const roleIds = roleRecords.map((r) => r.id);
    await usersRepository.createUserRoleLinks(created.id, roleIds, tx);

    if (body.primary_university_id) {
      await usersRepository.upsertUniversityUser(
        {
          university_id: body.primary_university_id,
          user_id: created.id,
          relationship_type: relationshipType,
        },
        tx
      );
    }

    return created;
  });

  if (!body.primary_university_id) {
    await ensureUserLinkedToUniversityFromEmail(user.id, body.email);
  }

  await recordAudit({
    userId: meta.actorUserId ?? requester.userId ?? null,
    universityId: body.primary_university_id ?? null,
    actionType: 'USER_CREATED',
    entityType: 'user',
    entityId: user.id,
    oldValues: null,
    newValues: {
      full_name: body.full_name,
      email: body.email,
      phone: body.phone ?? null,
      status,
      email_verified: Boolean(email_verified_at),
      primary_university_id: body.primary_university_id ?? null,
      university_specialty_id: specialtyFields.university_specialty_id,
      specialty_id: specialtyFields.specialty_id,
      role_codes: roleCodes,
      createdBy: meta.actorUserId ?? requester.userId ?? null,
    },
    ipAddress: meta.ipAddress ?? null,
  });

  return getUserById(user.id, requester);
}

async function updateUser(id, body, requester = {}, meta = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, existing);

  const currentRoleCodes = await loadUserRoleCodes(id);
  assertSuperAdminAdministrativeControlAllowed(requester, currentRoleCodes);
  const requestedRoleCodes = body.role_codes
    ? normalizeAssignedRoleCodes(body.role_codes)
    : undefined;
  assertSuperAdminRoleMutationAllowed({
    requester,
    currentRoleCodes,
    requestedRoleCodes,
  });
  assertProgramAdminNotNewlyAssigned({ requestedRoleCodes });

  if (body.email && body.email !== existing.email) {
    const clash = await usersRepository.findUserByEmail(body.email);
    if (clash && clash.id !== id) {
      throw new ApiError(409, 'البريد الإلكتروني مستخدم مسبقًا', null, 'EMAIL_EXISTS');
    }
  }

  const nextRoleCodes = requestedRoleCodes || normalizeRoleCodes(currentRoleCodes);

  let nextUniversityId =
    body.primary_university_id !== undefined
      ? body.primary_university_id
      : existing.primary_university_id;

  if (rolesRequireUniversity(nextRoleCodes) && !nextUniversityId) {
    throw new ApiError(400, 'تعيين الجامعة مطلوب لهذا الدور', null, 'UNIVERSITY_REQUIRED');
  }

  if (body.primary_university_id) {
    assertUniversityRecordAccess(requester, body.primary_university_id);
    const uni = await usersRepository.findUniversityById(body.primary_university_id);
    if (!uni) {
      throw new ApiError(404, 'الجامعة غير موجودة');
    }
  }

  const universityChanged =
    body.primary_university_id !== undefined &&
    String(body.primary_university_id || '') !== String(existing.primary_university_id || '');

  let requestedUniSpecialty =
    body.university_specialty_id !== undefined
      ? body.university_specialty_id
      : universityChanged
        ? null
        : existing.university_specialty_id;
  let requestedSpecialty =
    body.specialty_id !== undefined
      ? body.specialty_id
      : universityChanged && body.university_specialty_id === undefined
        ? null
        : existing.specialty_id;

  const specialtyFields = await resolveSpecialtyFields({
    primaryUniversityId: nextUniversityId,
    universitySpecialtyId: requestedUniSpecialty,
    specialtyId: requestedSpecialty,
    roleCodes: nextRoleCodes,
    requireStudentSpecialty: rolesIncludeStudent(nextRoleCodes),
  });

  const data = {};
  if (body.full_name !== undefined) data.full_name = body.full_name;
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === 'active' && !existing.activated_at) {
      data.activated_at = new Date();
    }
  }
  if (body.email_verified !== undefined) {
    if (body.email_verified === true && !existing.email_verified_at) {
      data.email_verified_at = new Date();
    } else if (body.email_verified === false) {
      data.email_verified_at = null;
    }
  }
  if (body.primary_university_id !== undefined) {
    data.primary_university_id = body.primary_university_id;
  }
  if (
    body.university_specialty_id !== undefined ||
    universityChanged ||
    body.role_codes !== undefined
  ) {
    data.university_specialty_id = specialtyFields.university_specialty_id;
  }
  if (
    body.specialty_id !== undefined ||
    universityChanged ||
    body.university_specialty_id !== undefined ||
    body.role_codes !== undefined
  ) {
    data.specialty_id = specialtyFields.specialty_id;
  }

  const oldSnapshot = {
    full_name: existing.full_name,
    email: existing.email,
    phone: existing.phone,
    status: existing.status,
    email_verified_at: existing.email_verified_at,
    primary_university_id: existing.primary_university_id,
    university_specialty_id: existing.university_specialty_id,
    specialty_id: existing.specialty_id,
  };

  const relationshipType =
    body.university_relationship_type || relationshipTypeForRoles(nextRoleCodes);

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      data.updated_at = new Date();
      await usersRepository.updateUser(id, data, tx);
    }

    if (body.role_codes) {
      const roleRecords = await usersRepository.findRolesByCodes(nextRoleCodes, tx);
      const foundCodes = new Set(roleRecords.map((r) => r.code.toLowerCase()));
      const missing = nextRoleCodes.filter((c) => !foundCodes.has(c.toLowerCase()));
      if (missing.length) {
        throw new ApiError(400, `رمز الدور غير معروف: ${missing.join(', ')}`);
      }
      await usersRepository.deleteAllUserRoles(id, tx);
      await usersRepository.createUserRoleLinks(
        id,
        roleRecords.map((r) => r.id),
        tx
      );
    }

    if (
      nextUniversityId &&
      (universityChanged ||
        body.role_codes ||
        body.university_relationship_type ||
        body.primary_university_id !== undefined)
    ) {
      await usersRepository.upsertUniversityUser(
        {
          university_id: nextUniversityId,
          user_id: id,
          relationship_type: relationshipType,
        },
        tx
      );
    }
  });

  await recordAudit({
    userId: meta.actorUserId ?? requester.userId ?? null,
    universityId: nextUniversityId ?? null,
    actionType: 'USER_UPDATED',
    entityType: 'user',
    entityId: id,
    oldValues: oldSnapshot,
    newValues: {
      ...data,
      role_codes: requestedRoleCodes ?? undefined,
      updatedBy: meta.actorUserId ?? requester.userId ?? null,
    },
    ipAddress: meta.ipAddress ?? null,
  });

  return getUserById(id, requester);
}

async function patchUserStatus(id, status, requester = {}, meta = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, existing);

  const currentRoleCodes = await loadUserRoleCodes(id);
  assertSuperAdminAdministrativeControlAllowed(requester, currentRoleCodes);

  if (
    String(requester.userId) === String(id) &&
    status !== 'active' &&
    (requester.isGlobal || (requester.roles || []).includes('super_admin'))
  ) {
    throw new ApiError(400, 'You cannot deactivate your own Super Admin account');
  }

  await usersRepository.updateUser(id, { status, updated_at: new Date() });

  await recordAudit({
    userId: meta.actorUserId ?? requester.userId ?? null,
    universityId: existing.primary_university_id ?? null,
    actionType: 'USER_STATUS_CHANGED',
    entityType: 'user',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status, updatedBy: meta.actorUserId ?? requester.userId ?? null },
    ipAddress: meta.ipAddress ?? null,
  });

  return getUserById(id, requester);
}

async function adminResetPassword(id, body, requester = {}, meta = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, existing);

  const currentRoleCodes = await loadUserRoleCodes(id);
  assertSuperAdminAdministrativeControlAllowed(requester, currentRoleCodes);

  const password_hash = await hashPassword(body.new_password);
  await prisma.users.update({
    where: { id },
    data: { password_hash, updated_at: new Date() },
  });

  await recordAudit({
    userId: meta.actorUserId ?? requester.userId ?? null,
    universityId: existing.primary_university_id ?? null,
    actionType: 'USER_PASSWORD_RESET',
    entityType: 'user',
    entityId: id,
    oldValues: null,
    newValues: { resetBy: meta.actorUserId ?? requester.userId ?? null },
    ipAddress: meta.ipAddress ?? null,
  });

  return {
    id,
    message: 'Password reset successfully',
  };
}

async function activateUser(id, { actorUserId, ipAddress, requester } = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  if (requester) {
    await assertUserAccessible(requester, existing);
    const currentRoleCodes = await loadUserRoleCodes(id);
    assertSuperAdminAdministrativeControlAllowed(requester, currentRoleCodes);
  }
  if (existing.status === 'suspended') {
    throw new ApiError(400, 'Suspended accounts cannot be activated via this endpoint');
  }
  if (existing.status === 'active') {
    return getUserById(id, requester);
  }
  if (!existing.email_verified_at) {
    throw new ApiError(400, 'لا يمكن تفعيل الحساب قبل توثيق البريد الإلكتروني.');
  }
  const now = new Date();
  try {
    await usersRepository.updateUser(id, {
      status: 'active',
      activated_at: now,
      updated_at: now,
    });
  } catch (err) {
    const msg = String(err?.message || '');
    const missingActivatedAt = err?.code === 'P2022' || msg.includes('activated_at');
    if (!missingActivatedAt) throw err;
    await usersRepository.updateUser(id, {
      status: 'active',
      updated_at: now,
    });
  }

  if (!existing.primary_university_id && existing.email) {
    await ensureUserLinkedToUniversityFromEmail(id, existing.email);
  }

  const refreshed = await usersRepository.findUserById(id);

  await recordAudit({
    userId: actorUserId ?? null,
    universityId: refreshed?.primary_university_id ?? existing.primary_university_id ?? null,
    actionType: 'USER_ACTIVATED',
    entityType: 'user',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'active', activated_at: now.toISOString() },
    ipAddress,
  });

  return getUserById(id, requester);
}

async function activateAllPendingStudents({
  university_id,
  user_ids,
  actorUserId,
  ipAddress,
  requester = {},
} = {}) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, university_id);
  const studentRole = await usersRepository.findRolesByCodes([env.STUDENT_ROLE_CODE]);
  if (!studentRole.length) {
    throw new ApiError(500, `Student role "${env.STUDENT_ROLE_CODE}" is missing`);
  }

  let pending;
  if (user_ids?.length) {
    const links = await usersRepository.findRoleLinksForUsers(user_ids);
    const studentUserIds = new Set(
      links.filter((l) => l.role_id === studentRole[0].id).map((l) => l.user_id)
    );
    pending = await prisma.users.findMany({
      where: {
        id: { in: [...studentUserIds] },
        status: 'inactive',
      },
      select: { id: true, email: true, full_name: true },
      orderBy: { created_at: 'asc' },
    });
  } else {
    pending = await usersRepository.findInactiveStudents({
      studentRoleId: studentRole[0].id,
      university_id: scopedUniversityId || undefined,
    });
  }

  let activated = 0;
  const errors = [];

  for (const row of pending) {
    try {
      await activateUser(row.id, { actorUserId, ipAddress, requester });
      activated += 1;
    } catch (err) {
      errors.push({
        id: row.id,
        email: row.email,
        message: err.message || 'Activation failed',
      });
    }
  }

  return {
    total_pending: pending.length,
    activated,
    failed: errors.length,
    errors,
  };
}

const EMAIL_ALREADY_VERIFIED_MSG = 'البريد الإلكتروني موثق مسبقًا.';
const EMAIL_VERIFIED_OK_MSG = 'تم توثيق البريد الإلكتروني بنجاح.';

/**
 * Manually verify a user's email. Does NOT change account status/activation.
 */
async function verifyUserEmail(id, { actorUserId, ipAddress, requester } = {}) {
  const otpRepository = require('../auth/emailVerificationOtp.repository');
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  if (requester) {
    await assertUserAccessible(requester, existing);
    const currentRoleCodes = await loadUserRoleCodes(id);
    assertSuperAdminAdministrativeControlAllowed(requester, currentRoleCodes);
  }

  if (existing.email_verified_at) {
    return {
      alreadyVerified: true,
      message: EMAIL_ALREADY_VERIFIED_MSG,
      id: existing.id,
      emailVerifiedAt: existing.email_verified_at,
      email_verified_at: existing.email_verified_at,
    };
  }

  const now = new Date();
  await usersRepository.updateUser(id, {
    email_verified_at: now,
    updated_at: now,
  });

  if (existing.email) {
    await otpRepository.invalidateActiveOtpsForUser(id, String(existing.email).trim().toLowerCase());
  }

  await recordAudit({
    userId: actorUserId ?? null,
    universityId: existing.primary_university_id ?? null,
    actionType: 'USER_EMAIL_VERIFIED',
    entityType: 'user',
    entityId: id,
    oldValues: { email_verified_at: null },
    newValues: { email_verified_at: now.toISOString(), verified_manually: true },
    ipAddress,
  });

  return {
    alreadyVerified: false,
    message: EMAIL_VERIFIED_OK_MSG,
    id,
    emailVerifiedAt: now,
    email_verified_at: now,
  };
}

/**
 * Bulk-verify emails for unverified users in admin scope / optional filters.
 * Does NOT activate accounts.
 */
async function verifyAllUnverifiedEmails({
  university_id,
  status,
  user_ids,
  actorUserId,
  ipAddress,
  requester = {},
} = {}) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, university_id);

  if (!isSystemWideAdmin(requester) && !scopedUniversityId) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      message: 'تم توثيق 0 حسابًا بنجاح.',
    };
  }

  let candidates;
  if (user_ids?.length) {
    candidates = await prisma.users.findMany({
      where: {
        id: { in: user_ids },
        email_verified_at: null,
        ...(status ? { status } : {}),
      },
      select: { id: true, email: true, email_verified_at: true, primary_university_id: true, status: true },
      orderBy: { created_at: 'asc' },
    });
  } else {
    const where = await usersRepository.buildListWhere({
      status,
      university_id: scopedUniversityId || undefined,
      email_verified: false,
    });
    candidates = await prisma.users.findMany({
      where,
      select: { id: true, email: true, email_verified_at: true, primary_university_id: true, status: true },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let unauthorizedCount = 0;

  for (const row of candidates) {
    try {
      const result = await verifyUserEmail(row.id, { actorUserId, ipAddress, requester });
      if (result.alreadyVerified) skippedCount += 1;
      else updatedCount += 1;
    } catch (err) {
      if (err?.statusCode === 403) unauthorizedCount += 1;
      else skippedCount += 1;
    }
  }

  await recordAudit({
    userId: actorUserId ?? null,
    universityId: scopedUniversityId ?? null,
    actionType: 'BULK_EMAIL_VERIFIED',
    entityType: 'user',
    entityId: null,
    oldValues: null,
    newValues: {
      updatedCount,
      skippedCount,
      unauthorizedCount,
      filters: {
        university_id: scopedUniversityId ?? null,
        status: status ?? null,
        user_ids_count: user_ids?.length ?? null,
      },
      performedBy: actorUserId ?? null,
    },
    ipAddress,
  });

  return {
    updatedCount,
    skippedCount,
    unauthorizedCount,
    message: `تم توثيق ${updatedCount} حسابًا بنجاح.`,
  };
}

/**
 * Verify selected user emails only (scope-enforced per user).
 */
async function bulkVerifyUserEmails(userIds, { actorUserId, ipAddress, requester } = {}) {
  const ids = [...new Set((userIds || []).map(String))];
  let updatedCount = 0;
  let skippedCount = 0;
  let unauthorizedCount = 0;

  for (const id of ids) {
    try {
      const result = await verifyUserEmail(id, { actorUserId, ipAddress, requester });
      if (result.alreadyVerified) skippedCount += 1;
      else updatedCount += 1;
    } catch (err) {
      if (err?.statusCode === 403 || err?.statusCode === 404) unauthorizedCount += 1;
      else skippedCount += 1;
    }
  }

  await recordAudit({
    userId: actorUserId ?? null,
    universityId: resolveUniversityIdFilter(requester, null) ?? null,
    actionType: 'BULK_EMAIL_VERIFIED',
    entityType: 'user',
    entityId: null,
    oldValues: null,
    newValues: {
      updatedCount,
      skippedCount,
      unauthorizedCount,
      filters: { userIds: ids },
      performedBy: actorUserId ?? null,
    },
    ipAddress,
  });

  return {
    updatedCount,
    skippedCount,
    unauthorizedCount,
    message: `تم توثيق ${updatedCount} حسابًا بنجاح.`,
  };
}

async function exportUsersExcel(query, requester = {}, meta = {}) {
  const applyFilters = query.apply_filters !== false;

  let requestedUniversityId = query.university_id || null;
  if (!requestedUniversityId && !isSystemWideAdmin(requester)) {
    requestedUniversityId = requester.universityId || null;
    if (!requestedUniversityId) {
      throw new ApiError(403, 'Forbidden');
    }
  }

  if (!requestedUniversityId && !isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'Forbidden: exporting all universities requires Super Admin');
  }

  const scopedUniversityId = resolveUniversityIdFilter(requester, requestedUniversityId);

  if (!isSystemWideAdmin(requester) && !scopedUniversityId) {
    throw new ApiError(403, 'Forbidden');
  }

  const whereParts = await usersRepository.buildListWhere({
    status: applyFilters ? query.status : undefined,
    university_id: scopedUniversityId,
    search: applyFilters ? query.search : undefined,
    email_verified: applyFilters ? query.email_verified : undefined,
  });

  let where = whereParts;
  if (applyFilters && query.role) {
    const roleUserIds = await usersRepository.findUserIdsByRoleCode(query.role);
    if (!roleUserIds.length) {
      where = { AND: [whereParts, { id: { in: [] } }] };
    } else {
      where = { AND: [whereParts, { id: { in: roleUserIds } }] };
    }
  }

  const rows = await usersRepository.findManyForExport(where);
  const withRoles = await mapUsersWithRoles(rows);

  const uniIds = [...new Set(withRoles.map((u) => u.primary_university_id).filter(Boolean))];
  const uspecIds = [...new Set(withRoles.map((u) => u.university_specialty_id).filter(Boolean))];
  const specIds = [...new Set(withRoles.map((u) => u.specialty_id).filter(Boolean))];

  const [unis, uspecs, specs, exporterName] = await Promise.all([
    usersRepository.findUniversitiesByIds(uniIds),
    usersRepository.findUniversitySpecialtiesByIds(uspecIds),
    usersRepository.findSpecialtiesByIds(specIds),
    usersRepository.findExporterName(meta.actorUserId || requester.userId),
  ]);

  const uniMap = new Map(unis.map((u) => [u.id, u]));
  const uspecMap = new Map(uspecs.map((s) => [s.id, s]));
  const specMap = new Map(specs.map((s) => [s.id, s]));

  let selectedUniversityName = null;
  if (scopedUniversityId) {
    const selected =
      uniMap.get(scopedUniversityId) || (await usersRepository.findUniversityById(scopedUniversityId));
    selectedUniversityName = selected?.name || null;
  }

  const enriched = withRoles.map((u) => {
    const uni = u.primary_university_id ? uniMap.get(u.primary_university_id) : null;
    const uspec = u.university_specialty_id ? uspecMap.get(u.university_specialty_id) : null;
    const spec = u.specialty_id ? specMap.get(u.specialty_id) : null;
    return {
      ...u,
      university_name: uni?.name || '',
      college_name: uspec?.college_name_ar || uspec?.college_name_en || '',
      university_specialty_name: uspec?.name_ar || uspec?.name_en || uspec?.code || '',
      specialty_name: spec?.name_ar || spec?.name_en || spec?.code || '',
    };
  });

  enriched.sort((a, b) => {
    const ua = a.university_name || '';
    const ub = b.university_name || '';
    const byUni = ua.localeCompare(ub, 'ar');
    if (byUni !== 0) return byUni;
    return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ar');
  });

  const filterBits = [];
  if (applyFilters) {
    if (query.role) filterBits.push(`الدور: ${query.role}`);
    if (query.status) filterBits.push(`الحالة: ${query.status}`);
    if (query.email_verified === true) filterBits.push('البريد: موثق');
    if (query.email_verified === false) filterBits.push('البريد: غير موثق');
    if (query.search) filterBits.push(`بحث: ${query.search}`);
  }

  const allUniversities = !scopedUniversityId;
  const result = await buildUsersExportWorkbook({
    users: enriched,
    meta: {
      scopeLabel: allUniversities ? 'جميع الجامعات' : 'جامعة محددة',
      universityName: selectedUniversityName,
      universityId: scopedUniversityId || null,
      allUniversities,
      exportedBy: exporterName || requester.email || requester.userId || '—',
      exportedAt: new Date(),
      filtersApplied: applyFilters,
      filtersSummary: filterBits.length ? filterBits.join(' | ') : 'لا توجد فلاتر إضافية',
    },
  });

  await recordAudit({
    userId: meta.actorUserId ?? requester.userId ?? null,
    universityId: scopedUniversityId ?? null,
    actionType: 'USERS_EXCEL_EXPORTED',
    entityType: 'user',
    entityId: null,
    oldValues: null,
    newValues: {
      scope: allUniversities ? 'all_universities' : 'single_university',
      universityId: scopedUniversityId ?? null,
      filters: applyFilters
        ? {
            role: query.role || null,
            status: query.status || null,
            email_verified: query.email_verified ?? null,
            search: query.search || null,
          }
        : null,
      apply_filters: applyFilters,
      exportedCount: result.exportedCount,
      performedBy: meta.actorUserId ?? requester.userId ?? null,
      filename: result.filename,
    },
    ipAddress: meta.ipAddress ?? null,
  });

  return result;
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  patchUserStatus,
  adminResetPassword,
  activateUser,
  activateAllPendingStudents,
  verifyUserEmail,
  verifyAllUnverifiedEmails,
  bulkVerifyUserEmails,
  exportUsersExcel,
};
