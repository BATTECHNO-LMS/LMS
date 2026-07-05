const repo = require('./analytics.repository');
const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('./prismaMissingTable.js');

function toRecognitionStatusKey(status) {
  const map = {
    draft: 'draft',
    in_preparation: 'inPreparation',
    ready_for_submission: 'readyForSubmission',
    submitted: 'submitted',
    under_review: 'underReview',
    approved: 'approved',
    rejected: 'rejected',
    needs_revision: 'needsRevision',
  };
  return map[status] || status;
}

function toCohortStatusKey(status) {
  return status === 'open_for_enrollment' ? 'openEnrollment' : status;
}

function cohortIdFilterForPrisma(scope, filters) {
  if (scope.cohortIds.length) return { cohort_id: { in: scope.cohortIds } };
  if (repo.hasScopedCohortFilter(filters)) return { cohort_id: { in: [] } };
  return {};
}

async function buildModuleSummaries(filters, kpis, certificatesAnalytics, universitiesOverview) {
  const [
    assessmentHealth,
    scope,
    usersTotal,
    usersActive,
    usersRecent,
    roles,
    userRoles,
    tracks,
    mcs,
    rubrics,
    submissions,
    grades,
    qaReviews,
    correctiveOpen,
    cohortsTotal,
    cohortsCompleted,
    sessionsTotal,
    sessionsDocumented,
    sessionsUndocumented,
    learningOutcomesTotal,
    contentModulesTotal,
    integrityTotal,
    integrityResolved,
  ] = await Promise.all([
    repo.getAssessmentHealth(filters),
    repo.resolveCohortScope(filters),
    prisma.users.count(),
    prisma.users.count({ where: { status: 'active' } }),
    prisma.users.count({ where: { created_at: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } }),
    prisma.roles.findMany({ select: { id: true, code: true } }),
    prisma.user_roles.findMany({ select: { role_id: true } }),
    prisma.tracks.findMany({ select: { id: true, name: true, status: true } }),
    prisma.micro_credentials.findMany({
      where: {
        ...(filters.track_id ? { track_id: filters.track_id } : {}),
      },
      select: { id: true, title: true, status: true },
    }),
    prisma.rubrics.count(),
    prisma.submissions.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.grades.findMany({ select: { score: true } }),
    prisma.qa_reviews.count(),
    prisma.corrective_actions.count({ where: { status: { in: ['open', 'in_progress', 'overdue'] } } }),
    prisma.cohorts.count(),
    prisma.cohorts.count({ where: { status: 'completed' } }),
    prisma.sessions.count(),
    prisma.sessions.count({ where: { documentation_status: 'documented' } }),
    prisma.sessions.count({ where: { documentation_status: { in: ['pending', 'incomplete'] } } }),
    prisma.learning_outcomes.count(),
    prisma.modules.count(),
    prisma.integrity_cases.count(),
    prisma.integrity_cases.count({ where: { status: { in: ['resolved', 'closed'] } } }),
  ]);

  const assessCohortWhere = cohortIdFilterForPrisma(scope, filters);
  const [assessmentTypeRows, assessmentsScopedTotal, assessmentsWithRubric, enrollRowsForMc] = await Promise.all([
    !repo.hasScopedCohortFilter(filters) || scope.cohortIds.length
      ? prisma.assessments.groupBy({
          by: ['assessment_type'],
          _count: { _all: true },
          orderBy: { _count: { id: 'desc' } },
          take: 6,
          ...(Object.keys(assessCohortWhere).length ? { where: assessCohortWhere } : {}),
        })
      : Promise.resolve([]),
    prisma.assessments.count({
      ...(Object.keys(assessCohortWhere).length ? { where: assessCohortWhere } : {}),
    }),
    prisma.assessments.count({
      where: {
        rubric_id: { not: null },
        ...(Object.keys(assessCohortWhere).length ? assessCohortWhere : {}),
      },
    }),
    prisma.enrollments.findMany({
      where: {
        enrollment_status: { in: ['enrolled', 'completed'] },
        ...(scope.cohortIds.length ? { cohort_id: { in: scope.cohortIds } } : repo.hasScopedCohortFilter(filters) ? { cohort_id: { in: [] } } : {}),
      },
      select: { cohort_id: true },
    }),
  ]);

  const roleMap = new Map(roles.map((r) => [r.id, r.code]));
  const byRoleMap = new Map();
  for (const ur of userRoles) {
    const code = roleMap.get(ur.role_id);
    if (!code) continue;
    byRoleMap.set(code, (byRoleMap.get(code) || 0) + 1);
  }

  const passCount = grades.filter((g) => Number(g.score) >= 60).length;
  const failCount = grades.length - passCount;
  const avgScore = grades.length ? Math.round((grades.reduce((s, g) => s + Number(g.score), 0) / grades.length) * 100) / 100 : 0;

  const evidenceAnalytics = await repo.getEvidenceAnalytics(filters);
  const attendanceAnalytics = await repo.getAttendanceAnalytics(filters);
  const qaIntegrity = await repo.getQaIntegrityOverview(filters);
  const recognitionFunnel = await repo.getRecognitionFunnel(filters);
  const openQa = qaIntegrity.find((x) => x.key === 'openQa')?.value || 0;
  const riskCases = qaIntegrity.find((x) => x.key === 'riskCases')?.value || 0;
  const integrityCases = qaIntegrity.find((x) => x.key === 'integrityCases')?.value || 0;
  const totalRecognition = recognitionFunnel.reduce((s, x) => s + x.count, 0);
  const approvedRecognition = recognitionFunnel.find((x) => x.statusKey === 'approved')?.count || 0;
  const approvedRate = totalRecognition ? Math.round((approvedRecognition / totalRecognition) * 10000) / 100 : 0;

  let cohortList = scope.cohorts;
  if (!cohortList.length && !repo.hasScopedCohortFilter(filters)) {
    cohortList = await prisma.cohorts.findMany({ select: { id: true, micro_credential_id: true } });
  }
  const mcIdsInScope = [...new Set(cohortList.map((c) => c.micro_credential_id).filter(Boolean))];
  const mcsWithTrack =
    mcIdsInScope.length > 0
      ? await prisma.micro_credentials.findMany({
          where: { id: { in: mcIdsInScope } },
          select: { id: true, title: true, track_id: true },
        })
      : [];
  const trackCounts = new Map();
  for (const c of cohortList) {
    const mc = mcsWithTrack.find((m) => m.id === c.micro_credential_id);
    if (mc?.track_id) trackCounts.set(mc.track_id, (trackCounts.get(mc.track_id) || 0) + 1);
  }
  let topTrackId = null;
  let bestTc = 0;
  for (const [tid, n] of trackCounts) {
    if (n > bestTc) {
      bestTc = n;
      topTrackId = tid;
    }
  }
  const topTrackRow = topTrackId ? await prisma.tracks.findUnique({ where: { id: topTrackId }, select: { name: true } }) : null;

  const cohortIdsNeeded = [...new Set(enrollRowsForMc.map((e) => e.cohort_id))];
  const cohortMcRows =
    cohortIdsNeeded.length > 0
      ? await prisma.cohorts.findMany({
          where: { id: { in: cohortIdsNeeded } },
          select: { id: true, micro_credential_id: true },
        })
      : [];
  const cohortToMc = new Map(cohortMcRows.map((c) => [c.id, c.micro_credential_id]));
  const mcEnrollCounts = new Map();
  for (const e of enrollRowsForMc) {
    const mcId = cohortToMc.get(e.cohort_id);
    if (!mcId) continue;
    mcEnrollCounts.set(mcId, (mcEnrollCounts.get(mcId) || 0) + 1);
  }
  let topMcId = null;
  let bestMc = 0;
  for (const [mid, n] of mcEnrollCounts) {
    if (n > bestMc) {
      bestMc = n;
      topMcId = mid;
    }
  }
  const topMcRow = topMcId ? await prisma.micro_credentials.findUnique({ where: { id: topMcId }, select: { title: true } }) : null;

  const topUniRow = [...universitiesOverview].sort((a, b) => b.students + b.cohorts * 8 - (a.students + a.cohorts * 8))[0];

  let hotspotAr = null;
  let hotspotEn = null;
  const lowFirst = attendanceAnalytics.lowAttendanceCohorts[0];
  if (lowFirst?.cohort_id) {
    const ch = await prisma.cohorts.findUnique({ where: { id: lowFirst.cohort_id }, select: { title: true } });
    hotspotAr = ch?.title ?? null;
    hotspotEn = ch?.title ?? null;
  }

  let reportsGeneratedPlaceholder = 0;
  let sensitiveActivitiesPlaceholder = 0;
  try {
    [reportsGeneratedPlaceholder, sensitiveActivitiesPlaceholder] = await Promise.all([
      prisma.audit_logs.count({ where: { entity_type: 'report' } }),
      prisma.audit_logs.count({
        where: { action_type: { in: ['integrity_case.reported', 'certificate.status', 'recognition_request.status'] } },
      }),
    ]);
  } catch (e) {
    if (!isMissingPrismaModelTableError(e, 'audit_logs')) throw e;
  }

  const subTotal = submissions.reduce((s, x) => s + x._count._all, 0);
  const onTimeStatuses = new Set(['submitted', 'graded', 'resubmitted']);
  const onTime = submissions.filter((s) => onTimeStatuses.has(s.status)).reduce((s, x) => s + x._count._all, 0);
  const late = submissions.find((s) => s.status === 'late')?._count._all || 0;
  const gradedSubs = submissions.find((s) => s.status === 'graded')?._count._all || 0;
  const completionRatePct =
    subTotal > 0 ? Math.round((gradedSubs / subTotal) * 10000) / 100 : 0;
  const rubricUsagePct = assessmentsScopedTotal ? Math.round((assessmentsWithRubric / assessmentsScopedTotal) * 10000) / 100 : 0;

  const cohortsByUniversity = universitiesOverview.map((u) => ({
    id: u.university_id,
    nameAr: u.name,
    nameEn: u.name,
    count: u.cohorts,
  }));

  return {
    users: {
      total: usersTotal,
      active: usersActive,
      recentAdds: usersRecent,
      byRole: [
        { roleKey: 'instructor', count: byRoleMap.get('instructor') || 0 },
        { roleKey: 'student', count: byRoleMap.get('student') || 0 },
        { roleKey: 'reviewer', count: byRoleMap.get('university_reviewer') || 0 },
        { roleKey: 'admin', count: (byRoleMap.get('super_admin') || 0) + (byRoleMap.get('program_admin') || 0) + (byRoleMap.get('university_admin') || 0) },
      ],
    },
    universities: {
      total: kpis.universities,
      activePartnerships: await prisma.universities.count({ where: { partnership_state: 'active' } }),
      topActivityNameAr: topUniRow?.name ?? null,
      topActivityNameEn: topUniRow?.name ?? null,
    },
    tracks: {
      total: tracks.length,
      topActiveAr: topTrackRow?.name || tracks.find((t) => t.status === 'active')?.name || tracks[0]?.name || null,
      topActiveEn: topTrackRow?.name || tracks.find((t) => t.status === 'active')?.name || tracks[0]?.name || null,
    },
    microCredentials: {
      total: mcs.length,
      active: mcs.filter((m) => m.status === 'active').length,
      archived: mcs.filter((m) => m.status === 'archived').length,
      topDeliveredAr: topMcRow?.title || mcs[0]?.title || null,
      topDeliveredEn: topMcRow?.title || mcs[0]?.title || null,
    },
    cohorts: {
      total: cohortsTotal,
      active: kpis.activeCohorts,
      completed: cohortsCompleted,
      byUniversity: cohortsByUniversity,
    },
    sessions: {
      total: sessionsTotal,
      documented: sessionsDocumented,
      undocumented: sessionsUndocumented,
    },
    attendance: {
      overallRate: kpis.attendanceRatePct,
      lowAttendanceCohorts: attendanceAnalytics.lowAttendanceCohorts.length,
      hotspotAr,
      hotspotEn,
    },
    assessments: {
      total: assessmentHealth.find((x) => x.key === 'total')?.value || 0,
      pendingGrading: assessmentHealth.find((x) => x.key === 'pendingGrading')?.value || 0,
      overdue: kpis.delayedAssessments,
      topTypes: assessmentTypeRows.length ? assessmentTypeRows.map((r) => r.assessment_type) : ['quiz', 'assignment', 'lab'],
    },
    rubrics: { total: rubrics, usageRatePct: rubricUsagePct },
    submissions: {
      total: subTotal,
      onTime,
      late,
    },
    grades: {
      completionRatePct,
      avgScore,
      pass: passCount,
      fail: failCount,
    },
    evidence: {
      totalFiles: evidenceAnalytics.totalEvidence,
      missing: evidenceAnalytics.missingEvidence,
      completionRatePct: evidenceAnalytics.totalEvidence + evidenceAnalytics.missingEvidence
        ? Math.round((evidenceAnalytics.totalEvidence / (evidenceAnalytics.totalEvidence + evidenceAnalytics.missingEvidence)) * 10000) / 100
        : 0,
    },
    qa: {
      totalReviews: qaReviews,
      openCases: openQa,
      unresolvedCorrective: correctiveOpen,
    },
    riskCases: { totalAtRisk: riskCases, trendKey: 'stable' },
    integrityCases: {
      total: integrityTotal,
      underInvestigation: integrityCases,
      resolved: integrityResolved,
    },
    recognition: {
      total: totalRecognition,
      readyForSubmission: kpis.recognitionReady,
      approvedRatePct: approvedRate,
    },
    certificates: {
      totalIssued: certificatesAnalytics.issuedCount,
      issuedThisMonth: certificatesAnalytics.byMonth.at(-1)?.count || 0,
    },
    learningOutcomes: { total: learningOutcomesTotal },
    content: { courseModules: contentModulesTotal },
    enrollments: {
      pendingReview: kpis.pendingEnrollments ?? 0,
    },
    reportsAudit: {
      reportsGeneratedPlaceholder,
      sensitiveActivitiesPlaceholder,
    },
  };
}

async function getOverviewAnalytics(filters) {
  const [{ kpis }, universitiesOverview, enrollmentGrowth, cohortStatus, assessmentHealth, attendance, evidence, qaIntegrity, recognitionFunnel, certificates] =
    await Promise.all([
      repo.getOverview(filters),
      repo.getUniversitiesOverview(filters),
      repo.getEnrollmentGrowth(filters),
      repo.getCohortStatusDistribution(filters),
      repo.getAssessmentHealth(filters),
      repo.getAttendanceAnalytics(filters),
      repo.getEvidenceAnalytics(filters),
      repo.getQaIntegrityOverview(filters),
      repo.getRecognitionFunnel(filters),
      repo.getCertificatesAnalytics(filters),
    ]);

  const modules = await buildModuleSummaries(filters, kpis, certificates, universitiesOverview);
  const insightKeys = [
    ...(kpis.pendingEnrollments > 0 ? [{ key: 'pendingEnrollments', params: { count: kpis.pendingEnrollments } }] : []),
    { key: 'recognitionReady', params: { count: kpis.recognitionReady } },
    { key: 'criticalLateAssessments', params: { count: kpis.delayedAssessments } },
  ];
  const alerts = [
    ...(kpis.pendingEnrollments > 0
      ? [{ severity: 'info', key: 'enrollmentPending', params: { count: kpis.pendingEnrollments } }]
      : []),
    { severity: 'warning', key: 'missingEvidence', params: { count: kpis.missingEvidence } },
    { severity: 'warning', key: 'qaOpen', params: { count: kpis.openQaIssues } },
    { severity: 'danger', key: 'integrityOpen', params: { count: kpis.openIntegrityCases } },
    { severity: 'warning', key: 'assessmentsLate', params: { count: kpis.delayedAssessments } },
  ];

  return {
    mode: 'live',
    filters,
    chartsEnabled: true,
    kpis,
    kpiTrends: Object.fromEntries(Object.keys(kpis).map((k) => [k, { pct: 0 }])),
    universitiesOverview: universitiesOverview.map((u) => ({ id: u.university_id, nameAr: u.name, nameEn: u.name, ...u })),
    enrollmentGrowth,
    cohortStatus: cohortStatus.map((c) => ({ ...c, statusKey: toCohortStatusKey(c.statusKey) })),
    assessmentHealth,
    attendanceTrend: attendance.trend,
    evidenceAnalytics: [
      { key: 'complete', value: evidence.totalEvidence, fill: '#34d399' },
      { key: 'missing', value: evidence.missingEvidence, fill: '#f87171' },
      ...evidence.byType.map((r) => ({ key: r.key, value: r.value, fill: '#6a73fa' })),
    ],
    qaIntegrityBar: qaIntegrity,
    recognitionFunnel: recognitionFunnel.map((r) => ({ ...r, statusKey: toRecognitionStatusKey(r.statusKey) })),
    certificatesByMonth: certificates.byMonth,
    certificatesByUniversity: certificates.byUniversity.map((u) => ({ id: u.university_id, nameAr: u.name, nameEn: u.name, count: u.count })),
    certificatesByCredential: certificates.byCredential.map((c) => ({ id: c.micro_credential_id, nameAr: c.title, nameEn: c.title, count: c.count })),
    modules,
    insightKeys,
    alerts,
  };
}

async function getUniversitiesAnalytics(filters) {
  const rows = await repo.getUniversitiesOverview(filters);
  return { universities_overview: rows };
}

async function getEnrollmentsAnalytics(filters) {
  return { enrollment_growth: await repo.getEnrollmentGrowth(filters) };
}

async function getCohortsAnalytics(filters) {
  return { cohort_status_distribution: await repo.getCohortStatusDistribution(filters) };
}

async function getAssessmentsAnalytics(filters) {
  return { assessment_health: await repo.getAssessmentHealth(filters) };
}

async function getAttendanceAnalytics(filters) {
  return { attendance: await repo.getAttendanceAnalytics(filters) };
}

async function getEvidenceAnalytics(filters) {
  return { evidence: await repo.getEvidenceAnalytics(filters) };
}

async function getQaIntegrityAnalytics(filters) {
  return { qa_integrity: await repo.getQaIntegrityOverview(filters) };
}

async function getRecognitionAnalytics(filters) {
  return { recognition_funnel: await repo.getRecognitionFunnel(filters) };
}

async function getCertificatesAnalytics(filters) {
  return { certificates: await repo.getCertificatesAnalytics(filters) };
}

async function getFieldTrainingAnalytics(filters) {
  return { field_training: await repo.getFieldTrainingAnalytics(filters) };
}

module.exports = {
  getOverviewAnalytics,
  getUniversitiesAnalytics,
  getEnrollmentsAnalytics,
  getCohortsAnalytics,
  getAssessmentsAnalytics,
  getAttendanceAnalytics,
  getEvidenceAnalytics,
  getQaIntegrityAnalytics,
  getRecognitionAnalytics,
  getCertificatesAnalytics,
  getFieldTrainingAnalytics,
};
