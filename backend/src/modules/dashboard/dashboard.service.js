const { prisma } = require('../../config/db');
const { cohortListWhere, assessmentCohortScopeWhere } = require('../../utils/deliveryAccess');
const { resolveUniversityIdFilter, isSystemWideAdmin } = require('../../utils/universityScope');

async function countUsers(requester) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, null);
  if (!isSystemWideAdmin(requester) && !scopedUniversityId) return 0;
  if (scopedUniversityId) {
    const memberIds = await prisma.university_users.findMany({
      where: { university_id: scopedUniversityId },
      select: { user_id: true },
    });
    const ids = memberIds.map((m) => m.user_id);
    return prisma.users.count({
      where: {
        OR: [
          { primary_university_id: scopedUniversityId },
          ...(ids.length ? [{ id: { in: ids } }] : []),
        ],
      },
    });
  }
  return prisma.users.count();
}

async function countUniversities(requester) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, null);
  if (scopedUniversityId) return 1;
  if (!isSystemWideAdmin(requester)) return 0;
  return prisma.universities.count({ where: { status: 'active' } });
}

async function countCohorts(requester) {
  const cw = cohortListWhere(requester);
  const where = cw || {};
  return prisma.cohorts.count({ where });
}

async function countAssessments(requester) {
  return prisma.assessments.count({ where: assessmentCohortScopeWhere(requester) });
}

async function countPendingEnrollments(requester) {
  const cw = cohortListWhere(requester);
  if (cw === null) {
    return prisma.enrollments.count({ where: { enrollment_status: 'pending' } });
  }
  const cohortIds = (
    await prisma.cohorts.findMany({ where: cw, select: { id: true } })
  ).map((c) => c.id);
  if (!cohortIds.length) return 0;
  return prisma.enrollments.count({
    where: { enrollment_status: 'pending', cohort_id: { in: cohortIds } },
  });
}

async function fetchRecentActivity(requester, limit = 10) {
  const scopedUniversityId = resolveUniversityIdFilter(requester, null);
  const where = {};
  if (scopedUniversityId) {
    where.university_id = scopedUniversityId;
  } else if (!isSystemWideAdmin(requester)) {
    return [];
  }

  const rows = await prisma.audit_logs.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      action_type: true,
      entity_type: true,
      entity_id: true,
      created_at: true,
      user_id: true,
    },
  });

  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    created_at: r.created_at,
    actor: r.user_id ? userMap.get(r.user_id) ?? { id: r.user_id } : null,
  }));
}

function resolveDashboardKpiSet(requester) {
  if (requester?.isGlobal) return 'global';
  if (requester?.organizationType === 'INSTITUTION') return 'institution';
  return 'university';
}

async function getInstitutionDashboardStats(requester) {
  const organizationId = requester.organizationId;
  if (!organizationId) {
    return {
      users: 0,
      universities: 0,
      cohorts: 0,
      assessments: 0,
      pending_enrollments: 0,
      recent_activity: [],
      programs: 0,
      kpi_set: 'institution',
    };
  }

  const [users, programs, cohorts, pending_enrollments, rows] = await Promise.all([
    prisma.user_organization_assignments.count({
      where: { organization_id: organizationId, is_active: true },
    }),
    prisma.training_programs.count({ where: { organization_id: organizationId } }),
    prisma.training_cohorts.count({ where: { organization_id: organizationId } }),
    prisma.user_organization_assignments.count({
      where: {
        organization_id: organizationId,
        is_active: true,
        users: { status: 'inactive', email_verified_at: { not: null } },
      },
    }),
    prisma.audit_logs.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        action_type: true,
        entity_type: true,
        entity_id: true,
        created_at: true,
        user_id: true,
      },
    }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const actors = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const actorMap = new Map(actors.map((u) => [u.id, u]));
  const recent_activity = rows.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    created_at: r.created_at,
    actor: r.user_id ? actorMap.get(r.user_id) ?? { id: r.user_id } : null,
  }));

  return {
    users,
    universities: 0,
    cohorts,
    assessments: 0,
    pending_enrollments,
    recent_activity,
    programs,
    kpi_set: 'institution',
  };
}

async function getAdminDashboardStats(requester) {
  const kpi_set = resolveDashboardKpiSet(requester);
  if (kpi_set === 'institution') {
    return getInstitutionDashboardStats(requester);
  }

  const [users, universities, cohorts, assessments, pending_enrollments, recent_activity] =
    await Promise.all([
      countUsers(requester),
      countUniversities(requester),
      countCohorts(requester),
      countAssessments(requester),
      countPendingEnrollments(requester),
      fetchRecentActivity(requester),
    ]);

  return {
    users,
    universities,
    cohorts,
    assessments,
    pending_enrollments,
    recent_activity,
    kpi_set,
  };
}

module.exports = { getAdminDashboardStats, resolveDashboardKpiSet, resolveDashboardKpiSet: resolveDashboardKpiSet };
