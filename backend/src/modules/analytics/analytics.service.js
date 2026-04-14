const repo = require('./analytics.repository');
const { prisma } = require('../../config/db');

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

async function buildModuleSummaries(filters, kpis, certificatesAnalytics) {
  const [usersTotal, usersActive, usersRecent, roles, userRoles, tracks, mcs, rubrics, submissions, grades, qaReviews, correctiveOpen] =
    await Promise.all([
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
      topActivityNameAr: null,
      topActivityNameEn: null,
    },
    tracks: {
      total: tracks.length,
      topActiveAr: tracks[0]?.name || null,
      topActiveEn: tracks[0]?.name || null,
    },
    microCredentials: {
      total: mcs.length,
      active: mcs.filter((m) => m.status === 'active').length,
      archived: mcs.filter((m) => m.status === 'archived').length,
      topDeliveredAr: mcs[0]?.title || null,
      topDeliveredEn: mcs[0]?.title || null,
    },
    cohorts: {
      total: await prisma.cohorts.count(),
      active: kpis.activeCohorts,
      completed: await prisma.cohorts.count({ where: { status: 'completed' } }),
      byUniversity: [],
    },
    sessions: {
      total: await prisma.sessions.count(),
      documented: await prisma.sessions.count({ where: { documentation_status: 'documented' } }),
      undocumented: await prisma.sessions.count({ where: { documentation_status: { in: ['pending', 'incomplete'] } } }),
    },
    attendance: {
      overallRate: kpis.attendanceRatePct,
      lowAttendanceCohorts: attendanceAnalytics.lowAttendanceCohorts.length,
      hotspotAr: null,
      hotspotEn: null,
    },
    assessments: {
      total: (await repo.getAssessmentHealth(filters)).find((x) => x.key === 'total')?.value || 0,
      pendingGrading: (await repo.getAssessmentHealth(filters)).find((x) => x.key === 'pendingGrading')?.value || 0,
      overdue: kpis.delayedAssessments,
      topTypes: ['quiz', 'assignment', 'lab'],
    },
    rubrics: { total: rubrics, usageRatePct: 0 },
    submissions: {
      total: submissions.reduce((s, x) => s + x._count._all, 0),
      onTime: submissions.find((s) => s.status === 'submitted')?._count._all || 0,
      late: submissions.find((s) => s.status === 'late')?._count._all || 0,
    },
    grades: {
      completionRatePct: 0,
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
      total: await prisma.integrity_cases.count(),
      underInvestigation: integrityCases,
      resolved: await prisma.integrity_cases.count({ where: { status: { in: ['resolved', 'closed'] } } }),
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
    reportsAudit: {
      reportsGeneratedPlaceholder: await prisma.audit_logs.count({ where: { entity_type: 'report' } }),
      sensitiveActivitiesPlaceholder: await prisma.audit_logs.count({
        where: { action_type: { in: ['integrity_case.reported', 'certificate.status', 'recognition_request.status'] } },
      }),
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

  const modules = await buildModuleSummaries(filters, kpis, certificates);
  const insightKeys = [
    { key: 'recognitionReady', params: { count: kpis.recognitionReady } },
    { key: 'criticalLateAssessments', params: { count: kpis.delayedAssessments } },
  ];
  const alerts = [
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
};
