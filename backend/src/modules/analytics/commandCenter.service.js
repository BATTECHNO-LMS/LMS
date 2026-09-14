'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { ApiError } = require('../../utils/apiError');
const { ANALYTICS_TIMEZONE, PRESENCE_WINDOW_SECONDS, FRESHNESS } = require('./analytics.definitions');
const { resolvePeriod } = require('./analytics.period');
const { resolveAnalyticsScope, enrichAnalyticsScope, cacheScopeKey } = require('./analytics.scope');
const { withCache } = require('./analytics.cache');
const { intCount } = require('./analytics.percent');
const { getUserAnalytics } = require('./commandCenter.users');
const { getFieldTrainingAnalytics } = require('./commandCenter.fieldTraining');
const { getRecordedLectureAnalytics } = require('./commandCenter.recordedLectures');
const { getCoursesAnalytics, getMicroCredentialAnalytics } = require('./commandCenter.courses');
const { getCertificateAnalytics } = require('./commandCenter.certificates');
const { getLiveActivity, getActivityHeatmap, getCurrentlyWatching } = require('./commandCenter.activity');
const {
  getOrganizationAnalytics,
  listFilterOrganizations,
  listFilterOpportunities,
} = require('./commandCenter.organizations');
const { getSystemHealth } = require('./commandCenter.system');
const { ftAppScopeSql } = require('./commandCenter.sql');

function metadata(scope, period, freshness) {
  return {
    generatedAt: new Date().toISOString(),
    timezone: ANALYTICS_TIMEZONE,
    freshness,
    presenceWindowSeconds: PRESENCE_WINDOW_SECONDS,
    period: {
      key: period.period,
      start: period.periodStart.toISOString(),
      end: period.periodEnd.toISOString(),
      aggregation: period.aggregation,
    },
    scope: {
      isGlobal: scope.isGlobal,
      organizationId: scope.organizationId || null,
      universityId: scope.universityId || null,
      organizationType: scope.organizationType || null,
      opportunityId: scope.opportunityId || null,
      role: scope.role || null,
      modules: scope.modules,
    },
  };
}

function buildSummary(users, fieldTraining, recordedLectures, certificates) {
  const cards = [
    {
      key: 'onlineUsers',
      available: Boolean(users.onlineUsers?.available),
      value: users.onlineUsers?.available ? users.onlineUsers.value : null,
      variant: 'live',
      comparison: null,
    },
    {
      key: 'activeUsers',
      available: true,
      value: users.activeUsers.value,
      variant: 'highlight',
      comparison: users.activeUsers.comparison,
      sparkline: users.sparkline,
    },
    {
      key: 'totalStudents',
      available: true,
      value: users.totalStudents.value,
      variant: 'standard',
    },
  ];

  if (fieldTraining?.available) {
    cards.push({
      key: 'trainingOpportunities',
      available: true,
      value: fieldTraining.opportunities,
      variant: 'standard',
    });
  }
  if (recordedLectures?.available) {
    cards.push({
      key: 'recordedLecturesPublished',
      available: true,
      value: recordedLectures.publishedLectures,
      variant: 'standard',
    });
  }
  cards.push({
    key: 'certificatesIssued',
    available: true,
    value: certificates.certificatesIssued,
    variant: 'progress',
    comparison: certificates.comparison,
  });
  return cards;
}

async function getCommandCenterOverview(requester, query) {
  const scope = await enrichAnalyticsScope(resolveAnalyticsScope(requester, query));
  const period = resolvePeriod(query);
  const key = `overview|${cacheScopeKey(scope, period)}|${query.orgMetric || 'activeUsers'}`;

  return withCache('near', key, async () => {
    const orgMetric = query.orgMetric || query.organizationMetric || 'activeUsers';
    const [
      users,
      fieldTraining,
      recordedLectures,
      courses,
      microCredentials,
      certificates,
      heatmap,
      organizations,
      liveActivity,
      currentlyWatching,
      systemHealth,
    ] = await Promise.all([
      getUserAnalytics(scope, period),
      getFieldTrainingAnalytics(scope, period),
      getRecordedLectureAnalytics(scope, period),
      getCoursesAnalytics(scope, period),
      getMicroCredentialAnalytics(scope, period),
      getCertificateAnalytics(scope, period),
      getActivityHeatmap(scope, period),
      getOrganizationAnalytics(scope, period, orgMetric),
      getLiveActivity(scope, { limit: 20 }),
      getCurrentlyWatching(scope),
      getSystemHealth(scope),
    ]);

    return {
      ...metadata(scope, period, FRESHNESS.NEAR.class),
      summary: buildSummary(users, fieldTraining, recordedLectures, certificates),
      users,
      fieldTraining,
      attendance: fieldTraining?.available ? fieldTraining.attendance : { available: false },
      assessments: fieldTraining?.available ? fieldTraining.assessments : { available: false },
      recordedLectures: { ...recordedLectures, currentlyWatching },
      courses,
      microCredentials,
      certificates,
      heatmap,
      organizations,
      liveActivity,
      systemHealth,
    };
  });
}

async function getLiveSnapshot(requester, query) {
  const scope = await enrichAnalyticsScope(resolveAnalyticsScope(requester, query));
  const period = resolvePeriod({ ...query, period: query.period || 'today' });
  const key = `live|${cacheScopeKey(scope, period)}`;
  return withCache('live', key, async () => {
    const [liveActivity, currentlyWatching] = await Promise.all([
      getLiveActivity(scope, { limit: 20, category: query.activityCategory }),
      getCurrentlyWatching(scope),
    ]);
    return {
      ...metadata(scope, period, FRESHNESS.LIVE.class),
      onlineUsers: {
        available: false,
        reason: 'AUTH_SESSIONS_NOT_AVAILABLE',
        presenceWindowSeconds: PRESENCE_WINDOW_SECONDS,
      },
      currentlyWatching,
      liveActivity,
    };
  });
}

async function getFilterOptions(requester, query) {
  const scope = await enrichAnalyticsScope(resolveAnalyticsScope(requester, query));
  const [organizations, opportunities] = await Promise.all([
    listFilterOrganizations(scope),
    listFilterOpportunities(scope),
  ]);
  return {
    organizations: organizations.map((o) => ({
      id: o.id,
      nameAr: o.name,
      nameEn: o.name_en || o.name,
      type: o.type,
    })),
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
    })),
    roles: scope.organizationType === 'INSTITUTION'
      ? ['trainee', 'trainer', 'admin', 'reviewer']
      : ['student', 'instructor', 'admin', 'reviewer', 'trainee', 'trainer'],
    modules: scope.modules,
    semesterAvailable: false,
    semesterNote: 'No academic_terms model exists; الفصل filter is deferred.',
  };
}

const SCORE_WHERE = {
  lt60: Prisma.sql`fe.final_score < 60`,
  '60_69': Prisma.sql`fe.final_score >= 60 AND fe.final_score < 70`,
  '70_79': Prisma.sql`fe.final_score >= 70 AND fe.final_score < 80`,
  '80_89': Prisma.sql`fe.final_score >= 80 AND fe.final_score < 90`,
  '90_100': Prisma.sql`fe.final_score >= 90 AND fe.final_score <= 100`,
};

async function getDrilldown(requester, query) {
  const scope = await enrichAnalyticsScope(resolveAnalyticsScope(requester, query));
  const type = String(query.type || '');
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  if (type === 'score_bucket') {
    if (!scope.modules.fieldTraining) throw new ApiError(403, 'غير متاح', null, 'FORBIDDEN');
    const bucket = SCORE_WHERE[query.bucket];
    if (!bucket) throw new ApiError(400, 'شريحة العلامة غير صالحة', null, 'ANALYTICS_BUCKET_INVALID');
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT u.id, u.full_name, fe.final_score, app.id AS application_id
        FROM field_training_final_evaluations fe
        JOIN field_training_applications app ON app.id = fe.application_id
        JOIN users u ON u.id = fe.student_id
        WHERE fe.is_current = true AND fe.final_score IS NOT NULL AND ${bucket}
          ${scope.universityId ? Prisma.sql`AND fe.university_id = ${scope.universityId}::uuid` : Prisma.empty}
          ${scope.opportunityId ? Prisma.sql`AND fe.opportunity_id = ${scope.opportunityId}::uuid` : Prisma.empty}
        ORDER BY fe.final_score DESC, u.full_name
        LIMIT ${pageSize} OFFSET ${offset}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM field_training_final_evaluations fe
        JOIN field_training_applications app ON app.id = fe.application_id
        WHERE fe.is_current = true AND fe.final_score IS NOT NULL AND ${bucket}
          ${scope.universityId ? Prisma.sql`AND fe.university_id = ${scope.universityId}::uuid` : Prisma.empty}
          ${scope.opportunityId ? Prisma.sql`AND fe.opportunity_id = ${scope.opportunityId}::uuid` : Prisma.empty}
      `,
    ]);
    return {
      type,
      page,
      pageSize,
      total: intCount(countRows[0]?.c),
      items: rows.map((r) => ({
        id: r.id,
        name: r.full_name,
        score: Number(r.final_score),
        applicationId: r.application_id,
      })),
    };
  }

  if (type === 'eligible') {
    if (!scope.modules.fieldTraining) throw new ApiError(403, 'غير متاح', null, 'FORBIDDEN');
    const rows = await prisma.$queryRaw`
      SELECT u.id, u.full_name, app.id AS application_id, app.completion_eligibility_status
      FROM field_training_applications app
      JOIN users u ON u.id = app.student_id
      WHERE app.status = 'approved'::field_training_application_status
        AND (
          COALESCE(
            UPPER(app.eligibility_reason #>> '{details,approvedEvaluationResult,approvedStatus}'),
            UPPER(app.completion_eligibility_status::text)
          ) IN ('ELIGIBLE')
        )
        ${ftAppScopeSql(scope)}
      ORDER BY u.full_name
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const countRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM field_training_applications app
      WHERE app.status = 'approved'::field_training_application_status
        AND (
          COALESCE(
            UPPER(app.eligibility_reason #>> '{details,approvedEvaluationResult,approvedStatus}'),
            UPPER(app.completion_eligibility_status::text)
          ) IN ('ELIGIBLE')
        )
        ${ftAppScopeSql(scope)}
    `;
    return {
      type,
      page,
      pageSize,
      total: intCount(countRows[0]?.c),
      items: rows.map((r) => ({ id: r.id, name: r.full_name, applicationId: r.application_id })),
    };
  }

  if (type === 'role') {
    const role = String(query.role || '').trim();
    const rows = await prisma.$queryRaw`
      SELECT u.id, u.full_name, r.code AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.code = ${role}
        ${scope.universityId ? Prisma.sql`AND (
          u.primary_university_id = ${scope.universityId}::uuid
          OR EXISTS (SELECT 1 FROM university_users uu WHERE uu.user_id = u.id AND uu.university_id = ${scope.universityId}::uuid)
        )` : Prisma.empty}
        ${scope.organizationId && !scope.universityId ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM user_organization_assignments uoa
          WHERE uoa.user_id = u.id AND uoa.organization_id = ${scope.organizationId}::uuid AND uoa.is_active = true
        )` : Prisma.empty}
      ORDER BY u.full_name
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    return {
      type,
      page,
      pageSize,
      total: rows.length < pageSize && page === 1 ? rows.length : null,
      items: rows.map((r) => ({ id: r.id, name: r.full_name, role: r.role })),
      href: `/admin/users?role=${encodeURIComponent(role)}`,
    };
  }

  throw new ApiError(400, 'نوع التفصيل غير مدعوم', null, 'ANALYTICS_DRILLDOWN_INVALID');
}

module.exports = {
  getCommandCenterOverview,
  getLiveSnapshot,
  getFilterOptions,
  getDrilldown,
  metadata,
};
