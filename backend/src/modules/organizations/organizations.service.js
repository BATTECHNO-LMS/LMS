'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../shared/services/audit.service');
const {
  assertOrganizationAccess,
  resolveOrganizationIdFilter,
  isSystemWideAdmin,
} = require('../../utils/organizationScope');
const { emitDomainEvent } = require('../notificationEngine');
const { AUTH_ERROR_CODES, messageForCode, buildActivationWaitMeta } = require('../../utils/authErrorCatalog');

function mapOrg(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    nameEn: row.name_en,
    shortName: row.short_name,
    code: row.code,
    institutionKind: row.institution_kind,
    website: row.website,
    country: row.country,
    city: row.city,
    address: row.address,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    logoUrl: row.logo_url,
    status: row.status,
    notes: row.notes,
    allowsPublicTraineeRegistration: Boolean(row.allows_public_trainee_registration),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listOrganizations(requester, { type } = {}) {
  const where = {};
  if (type) where.type = type;
  if (!isSystemWideAdmin(requester)) {
    const orgId = resolveOrganizationIdFilter(requester, null);
    if (!orgId) return [];
    where.id = orgId;
  }
  const rows = await prisma.organizations.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  const orgIds = rows.map((r) => r.id);
  if (!orgIds.length) return [];

  const [branchCounts, programCounts, assignments] = await Promise.all([
    prisma.organization_branches.groupBy({
      by: ['organization_id'],
      where: { organization_id: { in: orgIds } },
      _count: { _all: true },
    }),
    prisma.training_programs.groupBy({
      by: ['organization_id'],
      where: { organization_id: { in: orgIds }, type: 'TRAINING_COURSE' },
      _count: { _all: true },
    }),
    prisma.user_organization_assignments.findMany({
      where: { organization_id: { in: orgIds }, is_active: true },
      select: { organization_id: true, role_code: true },
    }),
  ]);

  const branchMap = new Map(branchCounts.map((r) => [r.organization_id, r._count._all]));
  const programMap = new Map(programCounts.map((r) => [r.organization_id, r._count._all]));
  const roleCounts = new Map();
  for (const a of assignments) {
    const key = a.organization_id;
    if (!roleCounts.has(key)) {
      roleCounts.set(key, { admin: 0, trainer: 0, trainee: 0, student: 0 });
    }
    const bucket = roleCounts.get(key);
    if (a.role_code === 'admin') bucket.admin += 1;
    else if (a.role_code === 'trainer') bucket.trainer += 1;
    else if (a.role_code === 'trainee') bucket.trainee += 1;
    else if (a.role_code === 'student') bucket.trainee += 1; // legacy label until fully migrated
  }

  return rows.map((row) => {
    const roles = roleCounts.get(row.id) || { admin: 0, trainer: 0, trainee: 0 };
    return {
      ...mapOrg(row),
      branchCount: branchMap.get(row.id) || 0,
      trainingCourseCount: programMap.get(row.id) || 0,
      adminCount: roles.admin,
      trainerCount: roles.trainer,
      traineeCount: roles.trainee,
    };
  });
}

async function listPublicInstitutions() {
  const rows = await prisma.organizations.findMany({
    where: {
      type: 'INSTITUTION',
      status: 'active',
      allows_public_trainee_registration: true,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      logo_url: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    logoUrl: r.logo_url,
  }));
}

async function listPublicBranches(organizationId) {
  const org = await prisma.organizations.findFirst({
    where: {
      id: organizationId,
      type: 'INSTITUTION',
      status: 'active',
      allows_public_trainee_registration: true,
    },
  });
  if (!org) throw new ApiError(404, 'Institution not found');
  const rows = await prisma.organization_branches.findMany({
    where: { organization_id: organizationId, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, code: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
  }));
}

async function listPublicDepartments(organizationId, branchId) {
  const org = await prisma.organizations.findFirst({
    where: { id: organizationId, type: 'INSTITUTION', status: 'active' },
  });
  if (!org) throw new ApiError(404, 'Institution not found');
  const rows = await prisma.organization_departments.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      ...(branchId ? { branch_id: branchId } : {}),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, name_en: true, code: true, branch_id: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.name_en,
    code: r.code,
    branchId: r.branch_id,
  }));
}

async function getOrganizationById(requester, id) {
  const row = await prisma.organizations.findUnique({ where: { id } });
  if (!row) throw new ApiError(404, 'Organization not found');
  assertOrganizationAccess(requester, row.id);
  return mapOrg(row);
}

async function createInstitution(requester, body) {
  if (!isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'Forbidden');
  }
  const row = await prisma.organizations.create({
    data: {
      type: 'INSTITUTION',
      name: body.name,
      name_en: body.name_en ?? null,
      short_name: body.short_name ?? null,
      code: body.code ?? null,
      institution_kind: body.institution_kind ?? null,
      website: body.website ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      address: body.address ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      logo_url: body.logo_url ?? null,
      notes: body.notes ?? null,
      status: body.status ?? 'active',
      allows_public_trainee_registration: body.allows_public_trainee_registration ?? false,
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId: row.id,
    actionType: 'ORGANIZATION_CREATED',
    entityType: 'organization',
    entityId: row.id,
    newValues: { type: row.type, name: row.name },
  });
  return mapOrg(row);
}

async function updateInstitution(requester, id, body) {
  const existing = await prisma.organizations.findUnique({ where: { id } });
  if (!existing || existing.type !== 'INSTITUTION') {
    throw new ApiError(404, 'Institution not found');
  }
  if (!isSystemWideAdmin(requester)) {
    assertOrganizationAccess(requester, id);
    if (!requester.roles?.includes('admin')) {
      throw new ApiError(403, 'Forbidden');
    }
    // Institution admins may update operational fields but not public-registration flag.
    if (body.allows_public_trainee_registration !== undefined) {
      throw new ApiError(403, 'Forbidden');
    }
  }
  const row = await prisma.organizations.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.name_en !== undefined ? { name_en: body.name_en } : {}),
      ...(body.short_name !== undefined ? { short_name: body.short_name } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.institution_kind !== undefined ? { institution_kind: body.institution_kind } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
      ...(body.country !== undefined ? { country: body.country } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.contact_email !== undefined ? { contact_email: body.contact_email } : {}),
      ...(body.contact_phone !== undefined ? { contact_phone: body.contact_phone } : {}),
      ...(body.logo_url !== undefined ? { logo_url: body.logo_url } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.allows_public_trainee_registration !== undefined
        ? { allows_public_trainee_registration: body.allows_public_trainee_registration }
        : {}),
      updated_at: new Date(),
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId: row.id,
    actionType: 'ORGANIZATION_UPDATED',
    entityType: 'organization',
    entityId: row.id,
    oldValues: { name: existing.name, status: existing.status },
    newValues: { name: row.name, status: row.status },
  });
  return mapOrg(row);
}

async function listBranches(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  const rows = await prisma.organization_branches.findMany({
    where: { organization_id: organizationId },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    nameEn: r.name_en,
    code: r.code,
    city: r.city,
    address: r.address,
    sortOrder: r.sort_order,
    isActive: r.is_active,
  }));
}

async function createBranch(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  const row = await prisma.organization_branches.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      name_en: body.name_en ?? null,
      code: body.code ?? null,
      city: body.city ?? null,
      address: body.address ?? null,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'ORG_BRANCH_CREATED',
    entityType: 'organization_branch',
    entityId: row.id,
    newValues: { name: row.name },
  });
  return {
    id: row.id,
    organizationId,
    name: row.name,
    code: row.code,
    city: row.city,
    address: row.address,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function updateBranch(requester, organizationId, branchId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  const existing = await prisma.organization_branches.findFirst({
    where: { id: branchId, organization_id: organizationId },
  });
  if (!existing) throw new ApiError(404, 'Branch not found');
  const row = await prisma.organization_branches.update({
    where: { id: branchId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.name_en !== undefined ? { name_en: body.name_en } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.city !== undefined ? { city: body.city } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.sort_order !== undefined ? { sort_order: body.sort_order } : {}),
      ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      updated_at: new Date(),
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'ORG_BRANCH_UPDATED',
    entityType: 'organization_branch',
    entityId: row.id,
    oldValues: { name: existing.name, is_active: existing.is_active },
    newValues: { name: row.name, is_active: row.is_active },
  });
  return {
    id: row.id,
    organizationId,
    name: row.name,
    code: row.code,
    city: row.city,
    address: row.address,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function listDepartments(requester, organizationId, branchId) {
  assertOrganizationAccess(requester, organizationId);
  const rows = await prisma.organization_departments.findMany({
    where: {
      organization_id: organizationId,
      ...(branchId ? { branch_id: branchId } : {}),
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    branchId: r.branch_id,
    name: r.name,
    nameEn: r.name_en,
    code: r.code,
    isActive: r.is_active,
  }));
}

async function createDepartment(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  const row = await prisma.organization_departments.create({
    data: {
      organization_id: organizationId,
      branch_id: body.branch_id ?? null,
      name: body.name,
      name_en: body.name_en ?? null,
      code: body.code ?? null,
      is_active: body.is_active ?? true,
    },
  });
  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'ORG_DEPARTMENT_CREATED',
    entityType: 'organization_department',
    entityId: row.id,
    newValues: { name: row.name },
  });
  return {
    id: row.id,
    organizationId,
    branchId: row.branch_id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
  };
}

async function assignUser(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }

  const org = await prisma.organizations.findUnique({ where: { id: organizationId } });
  if (!org) throw new ApiError(404, 'Organization not found');

  let roleCode = body.role_code;
  if (org.type === 'INSTITUTION') {
    if (roleCode === 'instructor') {
      throw new ApiError(
        400,
        'استخدم دور المدرب (trainer) لبوابة المؤسسات. دور instructor مخصص للجامعات.'
      );
    }
    if (roleCode === 'student') {
      throw new ApiError(
        400,
        'استخدم دور المتدرب (trainee) لبوابة المؤسسات. دور student مخصص للجامعات.'
      );
    }
    if (roleCode === 'super_admin') {
      throw new ApiError(403, 'Forbidden');
    }
    const existingActive = await prisma.user_organization_assignments.findFirst({
      where: {
        user_id: body.user_id,
        is_active: true,
        organizations: { type: 'INSTITUTION' },
      },
    });
    if (existingActive && existingActive.organization_id !== organizationId) {
      throw new ApiError(409, 'User already has an active institution assignment');
    }
  }
  if (org.type === 'UNIVERSITY' && (roleCode === 'trainer' || roleCode === 'trainee')) {
    throw new ApiError(
      400,
      roleCode === 'trainer'
        ? 'دور المدرب (trainer) مخصص لبوابة المؤسسات. استخدم instructor للجامعات.'
        : 'دور المتدرب (trainee) مخصص لبوابة المؤسسات. استخدم student للجامعات.'
    );
  }

  await prisma.user_organization_assignments.updateMany({
    where: {
      user_id: body.user_id,
      organization_id: organizationId,
      is_active: true,
    },
    data: { is_active: false, updated_at: new Date() },
  });

  const row = await prisma.user_organization_assignments.create({
    data: {
      user_id: body.user_id,
      organization_id: organizationId,
      role_code: roleCode,
      branch_id: body.branch_id ?? null,
      department_id: body.department_id ?? null,
      job_title: body.job_title ?? null,
      employee_number: body.employee_number ?? null,
      assigned_by: requester.userId,
      is_active: true,
    },
  });

  if (roleCode === 'trainer' || roleCode === 'trainee') {
    const roleRow = await prisma.roles.findUnique({ where: { code: roleCode } });
    if (roleRow) {
      const link = await prisma.user_roles.findFirst({
        where: { user_id: body.user_id, role_id: roleRow.id },
      });
      if (!link) {
        await prisma.user_roles.create({
          data: { user_id: body.user_id, role_id: roleRow.id },
        });
      }
    }
  }

  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'ORG_ASSIGNMENT_CREATED',
    entityType: 'user_organization_assignment',
    entityId: row.id,
    newValues: { userId: body.user_id, roleCode: roleCode },
  });

  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    roleCode: row.role_code,
    branchId: row.branch_id,
    departmentId: row.department_id,
    jobTitle: row.job_title,
    employeeNumber: row.employee_number,
    isActive: row.is_active,
  };
}

async function listMembers(requester, organizationId, query = {}) {
  assertOrganizationAccess(requester, organizationId);
  const assignments = await prisma.user_organization_assignments.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      ...(query.role_code ? { role_code: query.role_code } : {}),
    },
    orderBy: { assigned_at: 'desc' },
  });
  const userIds = [...new Set(assignments.map((a) => a.user_id))];
  const users = userIds.length
    ? await prisma.users.findMany({
        where: {
          id: { in: userIds },
          ...(query.status ? { status: query.status } : {}),
          ...(query.pending_activation
            ? { status: 'inactive', email_verified_at: { not: null } }
            : {}),
        },
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          status: true,
          email_verified_at: true,
          email_verification_method: true,
          activated_at: true,
          created_at: true,
          status_public_message: true,
        },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return assignments
    .map((a) => {
      const u = byId.get(a.user_id);
      if (!u) return null;
      const wait = buildActivationWaitMeta(u);
      return {
        assignmentId: a.id,
        userId: u.id,
        fullName: u.full_name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        roleCode: a.role_code,
        branchId: a.branch_id,
        departmentId: a.department_id,
        jobTitle: a.job_title,
        employeeNumber: a.employee_number,
        emailVerifiedAt: u.email_verified_at,
        emailVerificationMethod: u.email_verification_method,
        activatedAt: u.activated_at,
        overdue48h: wait.overdue48h,
        hoursPending: wait.hoursPending,
      };
    })
    .filter(Boolean);
}

async function verifyMemberEmail(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  const assignment = await prisma.user_organization_assignments.findFirst({
    where: {
      user_id: body.user_id,
      organization_id: organizationId,
      is_active: true,
    },
  });
  if (!assignment) throw new ApiError(404, 'Member assignment not found');

  const user = await prisma.users.findUnique({ where: { id: body.user_id } });
  if (!user) throw new ApiError(404, 'User not found');

  const updated = await prisma.users.update({
    where: { id: user.id },
    data: {
      email_verified_at: user.email_verified_at || new Date(),
      email_verification_method: body.method || 'ADMIN',
      updated_at: new Date(),
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: 'EMAIL_VERIFIED_ADMIN',
    entityType: 'user',
    entityId: user.id,
    newValues: {
      method: body.method || 'ADMIN',
      reason: body.reason,
    },
  });

  return {
    userId: updated.id,
    emailVerified: true,
    emailVerificationMethod: updated.email_verification_method,
    requiresAdminApproval: updated.status === 'inactive',
  };
}

async function changeMemberActivation(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden');
  }
  if (requester.roles?.includes('reviewer') && !isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only');
  }

  const assignment = await prisma.user_organization_assignments.findFirst({
    where: {
      user_id: body.user_id,
      organization_id: organizationId,
      is_active: true,
    },
  });
  if (!assignment) throw new ApiError(404, 'Member assignment not found');

  const user = await prisma.users.findUnique({ where: { id: body.user_id } });
  if (!user) throw new ApiError(404, 'User not found');

  let status = user.status;
  let activated_at = user.activated_at;
  let activated_by = user.activated_by;
  let status_public_message = user.status_public_message;

  if (body.action === 'activate') {
    if (!user.email_verified_at) {
      throw new ApiError(400, 'Email must be verified before activation');
    }
    status = 'active';
    activated_at = new Date();
    activated_by = requester.userId;
    status_public_message = null;
  } else if (body.action === 'reject') {
    status = 'rejected';
    status_public_message = body.reason || messageForCode(AUTH_ERROR_CODES.ACCOUNT_REJECTED);
  } else if (body.action === 'disable') {
    status = 'suspended';
    status_public_message = body.reason || null;
  }

  const updated = await prisma.users.update({
    where: { id: user.id },
    data: {
      status,
      activated_at,
      activated_by,
      status_public_message,
      updated_at: new Date(),
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId,
    actionType: `ACCOUNT_${body.action.toUpperCase()}`,
    entityType: 'user',
    entityId: user.id,
    oldValues: { status: user.status },
    newValues: { status: updated.status, reason: body.reason || null },
  });

  if (body.action === 'activate') {
    await emitDomainEvent('ACCOUNT_ACTIVATED', {
      affectedUserId: user.id,
      organizationId,
      entityType: 'user',
      entityId: user.id,
      templateVars: {
        student_name: user.full_name,
        email: user.email,
        action_url: '/institutions/login',
      },
    }).catch(() => null);
  }

  return {
    userId: updated.id,
    status: updated.status,
    activatedAt: updated.activated_at,
  };
}

async function getDashboardSummary(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  const [members, programs, cohorts, openAlerts, pendingUsers] = await Promise.all([
    prisma.user_organization_assignments.count({
      where: { organization_id: organizationId, is_active: true },
    }),
    prisma.training_programs.count({ where: { organization_id: organizationId } }),
    prisma.training_cohorts.count({ where: { organization_id: organizationId } }),
    prisma.kpi_alerts.count({ where: { organization_id: organizationId, is_active: true } }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM user_organization_assignments uoa
      JOIN users u ON u.id = uoa.user_id
      WHERE uoa.organization_id = ${organizationId}::uuid
        AND uoa.is_active = true
        AND u.status = 'inactive'
        AND u.email_verified_at IS NOT NULL
    `,
  ]);

  return {
    organizationId,
    memberCount: members,
    pendingActivationCount: pendingUsers?.[0]?.c ?? 0,
    programCount: programs,
    cohortCount: cohorts,
    activeAlertCount: openAlerts,
    readOnly: Boolean(requester.roles?.includes('reviewer') && !requester.isGlobal),
  };
}

async function notifyActivationOverdue() {
  const rows = await prisma.$queryRaw`
    SELECT u.id AS user_id, u.full_name, u.email, u.email_verified_at, uoa.organization_id
    FROM users u
    JOIN user_organization_assignments uoa ON uoa.user_id = u.id AND uoa.is_active = true
    JOIN organizations o ON o.id = uoa.organization_id AND o.type = 'INSTITUTION'
    WHERE u.status = 'inactive'
      AND u.email_verified_at IS NOT NULL
      AND u.email_verified_at <= (NOW() - INTERVAL '48 hours')
  `;

  for (const row of rows) {
    await emitDomainEvent('ACCOUNT_ACTIVATION_DELAYED', {
      organizationId: row.organization_id,
      affectedUserId: row.user_id,
      entityType: 'user',
      entityId: row.user_id,
      templateVars: {
        student_name: row.full_name,
        email: row.email,
        action_url: '/admin/institutions/members',
      },
    }).catch(() => null);
  }

  return { notified: rows.length };
}

module.exports = {
  listOrganizations,
  listPublicInstitutions,
  listPublicBranches,
  listPublicDepartments,
  getOrganizationById,
  createInstitution,
  updateInstitution,
  listBranches,
  createBranch,
  updateBranch,
  listDepartments,
  createDepartment,
  assignUser,
  listMembers,
  verifyMemberEmail,
  changeMemberActivation,
  getDashboardSummary,
  notifyActivationOverdue,
  mapOrg,
};
