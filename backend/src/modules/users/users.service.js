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
  return userRows.map((u) => ({
    ...u,
    roles: [...new Set(rolesByUser.get(u.id) || [])],
  }));
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
      meta: { page: query.page, page_size: query.page_size, total: 0, total_pages: 1 },
    };
  }
  const page = query.page;
  const page_size = query.page_size;
  const skip = (page - 1) * page_size;

  const [total, rows] = await Promise.all([
    usersRepository.countMany(where),
    usersRepository.findManyForList(where, skip, page_size),
  ]);

  const items = await mapUsersWithRoles(rows);
  const total_pages = Math.max(1, Math.ceil(total / page_size));

  return {
    items,
    meta: {
      page,
      page_size,
      total,
      total_pages,
    },
  };
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

  return {
    ...withRoles,
    primary_university: primaryUniversity,
    university_relationships,
  };
}

async function createUser(body, requester = {}) {
  if (body.primary_university_id) {
    assertUniversityRecordAccess(requester, body.primary_university_id);
  } else if (!isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'University assignment is required');
  }
  const existing = await usersRepository.findUserByEmail(body.email);
  if (existing) {
    throw new ApiError(409, 'Email already exists');
  }

  const roleRecords = await usersRepository.findRolesByCodes(body.role_codes);
  const foundCodes = new Set(roleRecords.map((r) => r.code.toLowerCase()));
  const missing = body.role_codes.filter((c) => !foundCodes.has(c.toLowerCase()));
  if (missing.length) {
    throw new ApiError(400, `Unknown role code(s): ${missing.join(', ')}`);
  }

  if (body.primary_university_id) {
    const uni = await usersRepository.findUniversityById(body.primary_university_id);
    if (!uni) {
      throw new ApiError(404, 'Primary university not found');
    }
  }

  const password_hash = await hashPassword(body.password);
  const status = body.status ?? 'active';
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const created = await usersRepository.createUser(
      {
        full_name: body.full_name,
        email: body.email,
        password_hash,
        phone: body.phone ?? null,
        status,
        primary_university_id: body.primary_university_id ?? null,
        email_verified_at: status === 'active' ? now : null,
        activated_at: status === 'active' ? now : null,
      },
      tx
    );

    const roleIds = roleRecords.map((r) => r.id);
    await usersRepository.createUserRoleLinks(created.id, roleIds, tx);

    if (body.primary_university_id && body.university_relationship_type) {
      await usersRepository.upsertUniversityUser(
        {
          university_id: body.primary_university_id,
          user_id: created.id,
          relationship_type: body.university_relationship_type,
        },
        tx
      );
    }

    return created;
  });

  if (!body.primary_university_id) {
    await ensureUserLinkedToUniversityFromEmail(user.id, body.email);
  }

  return getUserById(user.id, requester);
}

async function updateUser(id, body, requester = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, existing);

  if (body.primary_university_id) {
    assertUniversityRecordAccess(requester, body.primary_university_id);
    const uni = await usersRepository.findUniversityById(body.primary_university_id);
    if (!uni) {
      throw new ApiError(404, 'Primary university not found');
    }
  }

  const data = {};
  if (body.full_name !== undefined) data.full_name = body.full_name;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.status !== undefined) data.status = body.status;
  if (body.primary_university_id !== undefined) {
    data.primary_university_id = body.primary_university_id;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) {
      data.updated_at = new Date();
      await usersRepository.updateUser(id, data, tx);
    }

    if (body.role_codes) {
      const roleRecords = await usersRepository.findRolesByCodes(body.role_codes, tx);
      const foundCodes = new Set(roleRecords.map((r) => r.code.toLowerCase()));
      const missing = body.role_codes.filter((c) => !foundCodes.has(c.toLowerCase()));
      if (missing.length) {
        throw new ApiError(400, `Unknown role code(s): ${missing.join(', ')}`);
      }
      await usersRepository.deleteAllUserRoles(id, tx);
      await usersRepository.createUserRoleLinks(
        id,
        roleRecords.map((r) => r.id),
        tx
      );
    }
  });

  return getUserById(id, requester);
}

async function patchUserStatus(id, status, requester = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await assertUserAccessible(requester, existing);
  await usersRepository.updateUser(id, { status, updated_at: new Date() });
  return getUserById(id, requester);
}

async function activateUser(id, { actorUserId, ipAddress, requester } = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  if (requester) {
    await assertUserAccessible(requester, existing);
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

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  patchUserStatus,
  activateUser,
  activateAllPendingStudents,
  verifyUserEmail,
  verifyAllUnverifiedEmails,
  bulkVerifyUserEmails,
};
