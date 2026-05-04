const { prisma } = require('../../config/db');
const { env } = require('../../config/env');

function normalizeType(type) {
  const allowed = new Set([
    'info',
    'success',
    'warning',
    'danger',
    'system',
    'user_pending_activation',
    'action_required',
    'student_enrollment_requested',
    'enrollment_approved',
    'enrollment_rejected',
  ]);
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

  const data = {
    user_id: payload.userId,
    title: payload.title,
    body: payload.body ?? null,
    type: normalizeType(payload.type),
  };
  if (payload.actionUrl != null) {
    data.action_url = payload.actionUrl;
  }

  function isInvalidNotificationType(msg) {
    return (
      msg.includes('Invalid value for argument `type`') ||
      (msg.includes('invalid input value for enum') && msg.includes('notification_type'))
    );
  }

  async function createWithTypeFallback(err, attemptData) {
    const msg = String(err?.message || '');
    if (!isInvalidNotificationType(msg) || attemptData.type === 'system') {
      throw err;
    }
    // Stale Prisma client (run `npx prisma generate`) or DB enum behind migrations (`prisma migrate deploy`).
    // eslint-disable-next-line no-console
    console.warn(
      '[createNotificationForUser] Falling back to type "system" (extended enum not in client or database).',
      err?.code || msg.slice(0, 200)
    );
    return prisma.notifications.create({ data: { ...attemptData, type: 'system' } });
  }

  try {
    return await prisma.notifications.create({ data });
  } catch (err) {
    const msg = String(err?.message || '');
    const missingCol = msg.includes('action_url') || msg.includes('Unknown arg');
    if (missingCol) {
      delete data.action_url;
      try {
        return await prisma.notifications.create({ data });
      } catch (err2) {
        return createWithTypeFallback(err2, data);
      }
    }
    return createWithTypeFallback(err, data);
  }
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

/**
 * Active super_admin (any university) plus program_admin / academic_admin
 * linked to the given university (primary university or university_users membership).
 * @param {string} universityId
 * @returns {Promise<string[]>}
 */
async function findActiveAdminUserIdsForStudentRegistrationAlert(universityId) {
  const codes = ['super_admin', 'program_admin', 'academic_admin'];
  const roles = await prisma.roles.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));
  const ids = new Set();

  const superRoleId = roleIdByCode.get('super_admin');
  if (superRoleId) {
    const links = await prisma.user_roles.findMany({
      where: { role_id: superRoleId },
      select: { user_id: true },
    });
    const uids = [...new Set(links.map((l) => l.user_id))];
    if (uids.length) {
      const rows = await prisma.users.findMany({
        where: { id: { in: uids }, status: 'active' },
        select: { id: true },
      });
      rows.forEach((r) => ids.add(r.id));
    }
  }

  const scopedRoleIds = [roleIdByCode.get('program_admin'), roleIdByCode.get('academic_admin')].filter(Boolean);
  if (scopedRoleIds.length && universityId) {
    const memberships = await prisma.university_users.findMany({
      where: { university_id: universityId },
      select: { user_id: true },
    });
    const memberIds = new Set(memberships.map((m) => m.user_id));

    const links = await prisma.user_roles.findMany({
      where: { role_id: { in: scopedRoleIds } },
      select: { user_id: true },
    });
    const candidateIds = [...new Set(links.map((l) => l.user_id))];
    if (candidateIds.length) {
      const memberIdList = [...memberIds];
      const rows = await prisma.users.findMany({
        where: {
          id: { in: candidateIds },
          status: 'active',
          OR: [
            { primary_university_id: universityId },
            ...(memberIdList.length ? [{ id: { in: memberIdList } }] : []),
          ],
        },
        select: { id: true },
      });
      rows.forEach((r) => ids.add(r.id));
    }
  }

  return [...ids];
}

/**
 * Notify admins that a self-registered student account awaits activation.
 * @param {{ universityId: string, studentEmail: string, studentName: string }} params
 */
async function notifyAdminsStudentRegistrationPending(params) {
  const universityId = params?.universityId;
  const studentEmail = String(params?.studentEmail || '').trim();
  const studentName = String(params?.studentName || '').trim();
  if (!universityId) return { created_count: 0 };

  const userIds = await findActiveAdminUserIdsForStudentRegistrationAlert(universityId);
  const title = 'New Student Registration';
  const body = `A new student has registered and requires account activation. (${studentName} • ${studentEmail})`;

  const payload = {
    userIds,
    title,
    body,
    type: 'user_pending_activation',
  };

  try {
    return await createNotificationsForUsers(payload);
  } catch (err) {
    // DBs that have not applied the migration lack `user_pending_activation` on `notification_type`.
    const msg = String(err?.message || '');
    const isEnumMismatch =
      msg.includes('user_pending_activation') ||
      msg.includes('invalid input value for enum') ||
      err?.code === 'P2000' ||
      err?.code === '22P02';
    if (!isEnumMismatch) {
      throw err;
    }
    // eslint-disable-next-line no-console
    console.warn(
      '[notifyAdminsStudentRegistrationPending] Falling back to notification type "system" (apply prisma migration for user_pending_activation).',
      err?.code || err?.message
    );
    return createNotificationsForUsers({ ...payload, type: 'system' });
  }
}

/**
 * super_admin (all) + program_admin, academic_admin, university_reviewer scoped to the cohort university.
 * @param {string} universityId
 * @returns {Promise<string[]>}
 */
async function findStakeholdersForEnrollmentRequest(universityId) {
  if (!universityId) return [];
  const roles = await prisma.roles.findMany({
    where: { code: { in: ['super_admin', 'program_admin', 'academic_admin', 'university_reviewer'] } },
    select: { id: true, code: true },
  });
  const roleIdByCode = new Map(roles.map((r) => [r.code, r.id]));
  const ids = new Set();

  const superRoleId = roleIdByCode.get(env.SUPER_ADMIN_ROLE_CODE || 'super_admin');
  if (superRoleId) {
    const links = await prisma.user_roles.findMany({
      where: { role_id: superRoleId },
      select: { user_id: true },
    });
    const uids = [...new Set(links.map((l) => l.user_id))];
    if (uids.length) {
      const rows = await prisma.users.findMany({
        where: { id: { in: uids }, status: 'active' },
        select: { id: true },
      });
      rows.forEach((r) => ids.add(r.id));
    }
  }

  const scopedRoleIds = [
    roleIdByCode.get('program_admin'),
    roleIdByCode.get('academic_admin'),
    roleIdByCode.get('university_reviewer'),
  ].filter(Boolean);
  if (scopedRoleIds.length) {
    const memberships = await prisma.university_users.findMany({
      where: { university_id: universityId },
      select: { user_id: true },
    });
    const memberIds = new Set(memberships.map((m) => m.user_id));
    const links = await prisma.user_roles.findMany({
      where: { role_id: { in: scopedRoleIds } },
      select: { user_id: true },
    });
    const candidateIds = [...new Set(links.map((l) => l.user_id))];
    if (candidateIds.length) {
      const rows = await prisma.users.findMany({
        where: {
          id: { in: candidateIds },
          status: 'active',
          OR: [
            { primary_university_id: universityId },
            ...(memberIds.size ? [{ id: { in: [...memberIds] } }] : []),
          ],
        },
        select: { id: true },
      });
      rows.forEach((r) => ids.add(r.id));
    }
  }

  return [...ids];
}

/**
 * Reviewer-only users get the reviewer queue URL; staff get the admin enrollments list.
 * @param {string} userId
 */
async function resolveEnrollmentRequestActionUrl(userId) {
  const links = await prisma.user_roles.findMany({
    where: { user_id: userId },
    select: { role_id: true },
  });
  const roleIds = [...new Set(links.map((l) => l.role_id))];
  const roleRows =
    roleIds.length > 0
      ? await prisma.roles.findMany({
          where: { id: { in: roleIds } },
          select: { code: true },
        })
      : [];
  const codes = roleRows.map((r) => r.code);
  const isElevated = codes.some((c) =>
    ['super_admin', 'program_admin', 'academic_admin'].includes(c)
  );
  if (codes.includes('university_reviewer') && !isElevated) {
    return '/reviewer/enrollment-requests?status=pending';
  }
  return '/admin/enrollments?status=pending';
}

/**
 * Notify admins and reviewers that a student submitted an enrollment request.
 * @param {{ universityId: string }} params
 */
async function notifyStakeholdersStudentEnrollmentRequested(params) {
  const universityId = params?.universityId;
  if (!universityId) return { created_count: 0 };

  const userIds = await findStakeholdersForEnrollmentRequest(universityId);
  const title = 'طلب تسجيل جديد في دفعة';
  const body =
    'قام طالب بطلب التسجيل في دفعة جديدة، يرجى مراجعة الطلب والموافقة أو الرفض.';

  let created = 0;
  for (const userId of userIds) {
    const actionUrl = await resolveEnrollmentRequestActionUrl(userId);
    const row = await createNotificationForUser({
      userId,
      title,
      body,
      type: 'student_enrollment_requested',
      actionUrl,
      dedupeWindowHours: 1,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentEnrollmentApproved(studentUserId) {
  return createNotificationForUser({
    userId: studentUserId,
    title: 'تم قبول طلب التسجيل',
    body: 'تمت الموافقة على تسجيلك في الدفعة ويمكنك الآن الدخول للبرنامج.',
    type: 'enrollment_approved',
    actionUrl: '/student/programs',
  });
}

async function notifyStudentEnrollmentRejected(studentUserId) {
  return createNotificationForUser({
    userId: studentUserId,
    title: 'تم رفض طلب التسجيل',
    body: 'تم رفض طلب تسجيلك في الدفعة. يرجى مراجعة الإدارة لمزيد من التفاصيل.',
    type: 'enrollment_rejected',
    actionUrl: '/student/available-cohorts',
  });
}

module.exports = {
  normalizeType,
  createNotificationForUser,
  createNotificationsForUsers,
  userIdsByRoleCodes,
  findActiveAdminUserIdsForStudentRegistrationAlert,
  findStakeholdersForEnrollmentRequest,
  notifyAdminsStudentRegistrationPending,
  notifyStakeholdersStudentEnrollmentRequested,
  notifyStudentEnrollmentApproved,
  notifyStudentEnrollmentRejected,
};
