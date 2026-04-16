const { ApiError } = require('../../utils/apiError');
const { hashPassword } = require('../../utils/password');
const { prisma } = require('../../config/db');
const usersRepository = require('./users.repository');
const { recordAudit } = require('../../utils/auditRecorder');

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

async function listUsers(query) {
  const where = await usersRepository.buildListWhere({
    status: query.status,
    university_id: query.university_id,
    search: query.search,
  });
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

async function getUserById(id) {
  const user = await usersRepository.findUserById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
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

async function createUser(body) {
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

  const user = await prisma.$transaction(async (tx) => {
    const created = await usersRepository.createUser(
      {
        full_name: body.full_name,
        email: body.email,
        password_hash,
        phone: body.phone ?? null,
        status,
        primary_university_id: body.primary_university_id ?? null,
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

  return getUserById(user.id);
}

async function updateUser(id, body) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }

  if (body.primary_university_id) {
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

  return getUserById(id);
}

async function patchUserStatus(id, status) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  await usersRepository.updateUser(id, { status, updated_at: new Date() });
  return getUserById(id);
}

async function activateUser(id, { actorUserId, ipAddress } = {}) {
  const existing = await usersRepository.findUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }
  if (existing.status === 'suspended') {
    throw new ApiError(400, 'Suspended accounts cannot be activated via this endpoint');
  }
  if (existing.status === 'active') {
    return getUserById(id);
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

  await recordAudit({
    userId: actorUserId ?? null,
    universityId: existing.primary_university_id ?? null,
    actionType: 'USER_ACTIVATED',
    entityType: 'user',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: 'active', activated_at: now.toISOString() },
    ipAddress,
  });

  return getUserById(id);
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  patchUserStatus,
  activateUser,
};
