const { prisma } = require('../../config/db');

const COHORT_STATUSES = ['planned', 'open_for_enrollment', 'active', 'completed', 'closed', 'cancelled'];
const RECOGNITION_STATUSES = [
  'draft',
  'in_preparation',
  'ready_for_submission',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'needs_revision',
];

function inDateRange(field, filters) {
  if (!filters.from && !filters.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

function hasScopedCohortFilter(filters) {
  return Boolean(filters.cohort_id || filters.university_id || filters.track_id || filters.micro_credential_id);
}

function cohortIdWhere(scope, filters) {
  if (scope.cohortIds.length) return { in: scope.cohortIds };
  if (hasScopedCohortFilter(filters)) return { in: [] };
  return undefined;
}

async function resolveCohortScope(filters) {
  let microCredentialIds = null;
  if (filters.track_id) {
    const mcRows = await prisma.micro_credentials.findMany({
      where: { track_id: filters.track_id },
      select: { id: true },
    });
    microCredentialIds = mcRows.map((m) => m.id);
  }
  if (filters.micro_credential_id) {
    microCredentialIds = [filters.micro_credential_id];
  }
  const where = {
    ...(filters.cohort_id ? { id: filters.cohort_id } : {}),
    ...(filters.university_id ? { university_id: filters.university_id } : {}),
    ...(microCredentialIds ? { micro_credential_id: { in: microCredentialIds } } : {}),
  };
  const cohorts = await prisma.cohorts.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      university_id: true,
      micro_credential_id: true,
      instructor_id: true,
      created_at: true,
    },
  });
  return {
    cohorts,
    cohortIds: cohorts.map((c) => c.id),
    universityIds: [...new Set(cohorts.map((c) => c.university_id))],
    microCredentialIds: [...new Set(cohorts.map((c) => c.micro_credential_id))],
  };
}

function monthKeyFromDate(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function normalizeMonthSeries(map) {
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, count]) => ({ monthKey, count }));
}

async function getOverview(filters) {
  const scope = await resolveCohortScope(filters);
  const cohortFilter = cohortIdWhere(scope, filters);

  const totalUniversities = filters.university_id
    ? await prisma.universities.count({ where: { id: filters.university_id } })
    : await prisma.universities.count();

  const totalMicroCredentials =
    filters.track_id || filters.micro_credential_id || filters.university_id || filters.cohort_id
      ? scope.microCredentialIds.length
      : await prisma.micro_credentials.count();

  const activeCohorts = scope.cohorts.filter((c) => c.status === 'active').length;

  const enrollmentsWhere = {
    ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
    ...inDateRange('enrolled_at', filters),
  };
  const enrolledRows = await prisma.enrollments.findMany({
    where: enrollmentsWhere,
    select: { student_id: true, attendance_percentage: true, final_status: true },
  });
  const totalEnrolledStudents = new Set(enrolledRows.map((r) => r.student_id)).size;

  const sessions = await prisma.sessions.findMany({
    where: {
      ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
      ...inDateRange('session_date', filters),
    },
    select: { id: true, cohort_id: true },
  });
  const sessionIds = sessions.map((s) => s.id);
  let overallAttendanceRate = 0;
  if (sessionIds.length) {
    const records = await prisma.attendance_records.findMany({
      where: { session_id: { in: sessionIds } },
      select: { attendance_status: true },
    });
    if (records.length) {
      const attended = records.filter((r) => ['present', 'late', 'excused'].includes(r.attendance_status)).length;
      overallAttendanceRate = Math.round((attended / records.length) * 10000) / 100;
    }
  }

  const assessments = await prisma.assessments.findMany({
    where: {
      ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
      ...inDateRange('due_date', filters),
    },
    select: { id: true, due_date: true, status: true, assessment_type: true },
  });
  const assessmentIds = assessments.map((a) => a.id);
  const [submissionCounts, gradeCounts] = await Promise.all([
    assessmentIds.length
      ? prisma.submissions.groupBy({
          by: ['assessment_id'],
          where: { assessment_id: { in: assessmentIds } },
          _count: { _all: true },
        })
      : [],
    assessmentIds.length
      ? prisma.grades.groupBy({
          by: ['assessment_id'],
          where: { assessment_id: { in: assessmentIds } },
          _count: { _all: true },
        })
      : [],
  ]);
  const subMap = new Map(submissionCounts.map((r) => [r.assessment_id, r._count._all]));
  const gradeMap = new Map(gradeCounts.map((r) => [r.assessment_id, r._count._all]));
  const now = new Date();
  const delayedOrUngradedAssessments = assessments.filter((a) => {
    const duePassed = a.due_date && new Date(a.due_date) < now;
    const subs = subMap.get(a.id) || 0;
    const grads = gradeMap.get(a.id) || 0;
    const pendingGrading = subs > grads;
    return duePassed && (pendingGrading || ['published', 'open'].includes(a.status));
  }).length;

  const evidenceRows = await prisma.evidence_files.findMany({
    where: {
      ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
      ...inDateRange('created_at', filters),
    },
    select: { id: true, session_id: true },
  });
  const evidenceSessionIds = new Set(evidenceRows.map((e) => e.session_id).filter(Boolean));
  const missingEvidenceCount = sessions.filter((s) => !evidenceSessionIds.has(s.id)).length;

  const [readyRecognition, openQa, openIntegrity, issuedCertificates] = await Promise.all([
    prisma.recognition_requests.count({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        status: 'ready_for_submission',
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.qa_reviews.count({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        status: { in: ['open', 'in_progress'] },
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.integrity_cases.count({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        status: { in: ['reported', 'under_investigation'] },
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.certificates.count({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        status: 'issued',
        ...inDateRange('issued_at', filters),
      },
    }),
  ]);

  const activeUsers = await prisma.users.count({
    where: {
      status: 'active',
      ...(filters.university_id ? { primary_university_id: filters.university_id } : {}),
    },
  });

  return {
    kpis: {
      universities: totalUniversities,
      microCredentials: totalMicroCredentials,
      activeCohorts,
      enrolledStudents: totalEnrolledStudents,
      attendanceRatePct: overallAttendanceRate,
      delayedAssessments: delayedOrUngradedAssessments,
      missingEvidence: missingEvidenceCount,
      recognitionReady: readyRecognition,
      openQaIssues: openQa,
      openIntegrityCases: openIntegrity,
      certificatesIssued: issuedCertificates,
      activeUsers,
    },
    scope,
  };
}

async function getUniversitiesOverview(filters) {
  const scope = await resolveCohortScope(filters);
  const uniIds = scope.universityIds;
  if (!uniIds.length) return [];
  const universities = await prisma.universities.findMany({
    where: { id: { in: uniIds } },
    select: { id: true, name: true },
  });
  const uniCohorts = new Map(uniIds.map((u) => [u, []]));
  scope.cohorts.forEach((c) => {
    if (uniCohorts.has(c.university_id)) uniCohorts.get(c.university_id).push(c.id);
  });
  const result = [];
  for (const uni of universities) {
    const cohortIds = uniCohorts.get(uni.id) || [];
    const enrollRows = cohortIds.length
      ? await prisma.enrollments.findMany({
          where: { cohort_id: { in: cohortIds }, ...inDateRange('enrolled_at', filters) },
          select: { student_id: true },
        })
      : [];
    const recognitionCount = cohortIds.length
      ? await prisma.recognition_requests.count({
          where: { cohort_id: { in: cohortIds }, ...inDateRange('created_at', filters) },
        })
      : 0;
    result.push({
      university_id: uni.id,
      name: uni.name,
      cohorts: cohortIds.length,
      students: new Set(enrollRows.map((r) => r.student_id)).size,
      recognitionRequests: recognitionCount,
    });
  }
  return result;
}

async function getEnrollmentGrowth(filters) {
  const scope = await resolveCohortScope(filters);
  const rows = await prisma.enrollments.findMany({
    where: {
      ...(cohortIdWhere(scope, filters) ? { cohort_id: cohortIdWhere(scope, filters) } : {}),
      ...inDateRange('enrolled_at', filters),
    },
    select: { enrolled_at: true },
  });
  const byMonth = new Map();
  for (const row of rows) {
    const key = monthKeyFromDate(new Date(row.enrolled_at));
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  return normalizeMonthSeries(byMonth).map((r) => ({ monthKey: r.monthKey, enrollments: r.count }));
}

async function getCohortStatusDistribution(filters) {
  const scope = await resolveCohortScope(filters);
  const statusMap = new Map(COHORT_STATUSES.map((s) => [s, 0]));
  for (const c of scope.cohorts) statusMap.set(c.status, (statusMap.get(c.status) || 0) + 1);
  return COHORT_STATUSES.map((statusKey) => ({ statusKey, count: statusMap.get(statusKey) || 0 }));
}

async function getAssessmentHealth(filters) {
  const scope = await resolveCohortScope(filters);
  const scopedCohorts = cohortIdWhere(scope, filters);
  const assessments = await prisma.assessments.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('due_date', filters),
    },
    select: { id: true, due_date: true, status: true },
  });
  const ids = assessments.map((a) => a.id);
  const [subs, grades] = await Promise.all([
    ids.length
      ? prisma.submissions.groupBy({
          by: ['assessment_id'],
          where: { assessment_id: { in: ids } },
          _count: { _all: true },
        })
      : [],
    ids.length
      ? prisma.grades.groupBy({
          by: ['assessment_id'],
          where: { assessment_id: { in: ids } },
          _count: { _all: true },
        })
      : [],
  ]);
  const subMap = new Map(subs.map((r) => [r.assessment_id, r._count._all]));
  const gradeMap = new Map(grades.map((r) => [r.assessment_id, r._count._all]));
  const now = new Date();
  const total = assessments.length;
  const overdue = assessments.filter((a) => a.due_date && new Date(a.due_date) < now && ['published', 'open'].includes(a.status)).length;
  const pendingGrading = assessments.filter((a) => (subMap.get(a.id) || 0) > (gradeMap.get(a.id) || 0)).length;
  const graded = assessments.filter((a) => (subMap.get(a.id) || 0) > 0 && (subMap.get(a.id) || 0) <= (gradeMap.get(a.id) || 0)).length;
  return [
    { key: 'total', value: total },
    { key: 'pendingGrading', value: pendingGrading },
    { key: 'overdue', value: overdue },
    { key: 'graded', value: graded },
  ];
}

async function getAttendanceAnalytics(filters) {
  const scope = await resolveCohortScope(filters);
  const scopedCohorts = cohortIdWhere(scope, filters);
  const sessions = await prisma.sessions.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('session_date', filters),
    },
    orderBy: { session_date: 'asc' },
    select: { id: true, session_date: true, cohort_id: true },
  });
  if (!sessions.length) {
    return {
      trend: [],
      statusBreakdown: { present: 0, absent: 0, late: 0, excused: 0 },
      lowAttendanceCohorts: [],
    };
  }
  const records = await prisma.attendance_records.findMany({
    where: { session_id: { in: sessions.map((s) => s.id) } },
    select: { session_id: true, attendance_status: true },
  });
  const bySession = new Map();
  for (const rec of records) {
    if (!bySession.has(rec.session_id)) bySession.set(rec.session_id, []);
    bySession.get(rec.session_id).push(rec.attendance_status);
  }
  const bucketSize = Math.max(1, Math.ceil(sessions.length / 4));
  const trend = [];
  for (let i = 0; i < 4; i += 1) {
    const slice = sessions.slice(i * bucketSize, (i + 1) * bucketSize);
    if (!slice.length) continue;
    let total = 0;
    let attended = 0;
    for (const s of slice) {
      const statuses = bySession.get(s.id) || [];
      total += statuses.length;
      attended += statuses.filter((st) => ['present', 'late', 'excused'].includes(st)).length;
    }
    const rate = total ? Math.round((attended / total) * 10000) / 100 : 0;
    trend.push({ weekKey: `W${i + 1}`, rate });
  }
  const statusBreakdown = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const rec of records) {
    if (statusBreakdown[rec.attendance_status] !== undefined) statusBreakdown[rec.attendance_status] += 1;
  }
  const lowAttendanceRows = await prisma.enrollments.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      attendance_percentage: { lt: 75 },
    },
    select: { cohort_id: true, attendance_percentage: true },
  });
  const lowByCohort = new Map();
  for (const r of lowAttendanceRows) {
    lowByCohort.set(r.cohort_id, (lowByCohort.get(r.cohort_id) || 0) + 1);
  }
  return {
    trend,
    statusBreakdown,
    lowAttendanceCohorts: [...lowByCohort.entries()].map(([cohort_id, low_count]) => ({ cohort_id, low_count })),
  };
}

async function getEvidenceAnalytics(filters) {
  const scope = await resolveCohortScope(filters);
  const scopedCohorts = cohortIdWhere(scope, filters);
  const evidence = await prisma.evidence_files.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('created_at', filters),
    },
    select: { id: true, evidence_type: true, session_id: true },
  });
  const sessions = await prisma.sessions.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('session_date', filters),
    },
    select: { id: true },
  });
  const evidenceSessionIds = new Set(evidence.map((e) => e.session_id).filter(Boolean));
  const missing = sessions.filter((s) => !evidenceSessionIds.has(s.id)).length;
  const byTypeMap = new Map();
  for (const ev of evidence) {
    byTypeMap.set(ev.evidence_type, (byTypeMap.get(ev.evidence_type) || 0) + 1);
  }
  return {
    totalEvidence: evidence.length,
    missingEvidence: missing,
    byType: [...byTypeMap.entries()].map(([key, value]) => ({ key, value })),
  };
}

async function getQaIntegrityOverview(filters) {
  const scope = await resolveCohortScope(filters);
  const cohortWhere = cohortIdWhere(scope, filters);
  const [openQa, correctiveInProgress, riskCases, integrityCases] = await Promise.all([
    prisma.qa_reviews.count({
      where: {
        ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
        status: { in: ['open', 'in_progress'] },
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.corrective_actions.count({
      where: {
        status: { in: ['open', 'in_progress', 'overdue'] },
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.risk_cases.count({
      where: {
        ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
        status: { in: ['open', 'in_progress', 'escalated'] },
        ...inDateRange('created_at', filters),
      },
    }),
    prisma.integrity_cases.count({
      where: {
        ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
        status: { in: ['reported', 'under_investigation'] },
        ...inDateRange('created_at', filters),
      },
    }),
  ]);
  return [
    { key: 'openQa', value: openQa },
    { key: 'correctiveProgress', value: correctiveInProgress },
    { key: 'riskCases', value: riskCases },
    { key: 'integrityCases', value: integrityCases },
  ];
}

async function getRecognitionFunnel(filters) {
  const scope = await resolveCohortScope(filters);
  const scopedCohorts = cohortIdWhere(scope, filters);
  const rows = await prisma.recognition_requests.groupBy({
    by: ['status'],
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('created_at', filters),
    },
    _count: { _all: true },
  });
  const map = new Map(rows.map((r) => [r.status, r._count._all]));
  return RECOGNITION_STATUSES.map((statusKey) => ({
    statusKey,
    count: map.get(statusKey) || 0,
  }));
}

async function getCertificatesAnalytics(filters) {
  const scope = await resolveCohortScope(filters);
  const scopedCohorts = cohortIdWhere(scope, filters);
  const certs = await prisma.certificates.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('issued_at', filters),
    },
    select: { id: true, issued_at: true, cohort_id: true, micro_credential_id: true, status: true },
  });
  const issued = certs.filter((c) => c.status === 'issued');
  const byMonth = new Map();
  for (const cert of issued) {
    const key = monthKeyFromDate(new Date(cert.issued_at));
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  }
  const cohorts = await prisma.cohorts.findMany({
    where: { id: { in: [...new Set(issued.map((c) => c.cohort_id))] } },
    select: { id: true, university_id: true },
  });
  const cohortUniversity = new Map(cohorts.map((c) => [c.id, c.university_id]));
  const uniMap = new Map();
  for (const cert of issued) {
    const uniId = cohortUniversity.get(cert.cohort_id);
    if (!uniId) continue;
    uniMap.set(uniId, (uniMap.get(uniId) || 0) + 1);
  }
  const universities = await prisma.universities.findMany({
    where: { id: { in: [...uniMap.keys()] } },
    select: { id: true, name: true },
  });
  const byUniversity = universities.map((u) => ({
    university_id: u.id,
    name: u.name,
    count: uniMap.get(u.id) || 0,
  }));
  const mcMap = new Map();
  for (const cert of issued) {
    mcMap.set(cert.micro_credential_id, (mcMap.get(cert.micro_credential_id) || 0) + 1);
  }
  const mcs = await prisma.micro_credentials.findMany({
    where: { id: { in: [...mcMap.keys()] } },
    select: { id: true, title: true, code: true },
  });
  const byCredential = mcs.map((mc) => ({
    micro_credential_id: mc.id,
    title: mc.title,
    code: mc.code,
    count: mcMap.get(mc.id) || 0,
  }));
  return {
    byMonth: normalizeMonthSeries(byMonth),
    byUniversity,
    byCredential,
    issuedCount: issued.length,
  };
}

module.exports = {
  getOverview,
  getUniversitiesOverview,
  getEnrollmentGrowth,
  getCohortStatusDistribution,
  getAssessmentHealth,
  getAttendanceAnalytics,
  getEvidenceAnalytics,
  getQaIntegrityOverview,
  getRecognitionFunnel,
  getCertificatesAnalytics,
};
