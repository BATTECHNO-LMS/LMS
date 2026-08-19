const { prisma } = require('../../config/db');

function isMissingDbObjectError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    err.code === 'P2021' ||
    msg.includes('does not exist in the current database') ||
    (/relation/i.test(msg) && /does not exist/i.test(msg))
  );
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function safeQuery(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (isMissingDbObjectError(err)) return fallback;
    throw err;
  }
}

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

async function resolveCohortIds(filters) {
  let microCredentialIds = null;
  if (filters.track_id) {
    const mcs = await safeQuery(
      () =>
        prisma.micro_credentials.findMany({
          where: { track_id: filters.track_id },
          select: { id: true },
        }),
      []
    );
    microCredentialIds = mcs.map((m) => m.id);
  }
  if (filters.micro_credential_id) microCredentialIds = [filters.micro_credential_id];
  const cohorts = await safeQuery(
    () =>
      prisma.cohorts.findMany({
        where: {
          ...(filters.cohort_id ? { id: filters.cohort_id } : {}),
          ...(filters.university_id ? { university_id: filters.university_id } : {}),
          ...(microCredentialIds ? { micro_credential_id: { in: microCredentialIds } } : {}),
        },
        select: { id: true },
      }),
    []
  );
  return cohorts.map((c) => c.id);
}

function cohortWhereFromIds(cohortIds, filters) {
  if (cohortIds.length) return { in: cohortIds };
  if (hasScopedCohortFilter(filters)) return { in: [] };
  return undefined;
}

async function universitiesReport(filters) {
  const scopedCohortIds = await resolveCohortIds(filters);
  const cohortScope = cohortWhereFromIds(scopedCohortIds, filters);
  const cohorts = await safeQuery(
    () =>
      prisma.cohorts.findMany({
        where: {
          ...(cohortScope ? { id: cohortScope } : {}),
          ...inDateRange('created_at', filters),
        },
        select: { id: true, university_id: true, micro_credential_id: true },
      }),
    []
  );
  const uniIds = [...new Set(cohorts.map((c) => c.university_id))];
  const universities = uniIds.length
    ? await safeQuery(
        () =>
          prisma.universities.findMany({
            where: { id: { in: uniIds } },
            select: { id: true, name: true, status: true, partnership_state: true },
          }),
        []
      )
    : [];
  if (!universities.length) return [];

  const allCohortIds = cohorts.map((c) => c.id);
  const [enrollments, recognitionGroups, certificateGroups, membershipGroups] = await Promise.all([
    allCohortIds.length
      ? safeQuery(
          () =>
            prisma.enrollments.findMany({
              where: { cohort_id: { in: allCohortIds }, ...inDateRange('enrolled_at', filters) },
              select: { student_id: true, cohort_id: true },
            }),
          []
        )
      : [],
    allCohortIds.length
      ? safeQuery(
          () =>
            prisma.recognition_requests.groupBy({
              by: ['cohort_id'],
              where: { cohort_id: { in: allCohortIds }, ...inDateRange('created_at', filters) },
              _count: { _all: true },
            }),
          []
        )
      : [],
    allCohortIds.length
      ? safeQuery(
          () =>
            prisma.certificates.groupBy({
              by: ['cohort_id'],
              where: { cohort_id: { in: allCohortIds }, ...inDateRange('issued_at', filters) },
              _count: { _all: true },
            }),
          []
        )
      : [],
    uniIds.length
      ? safeQuery(
          () =>
            prisma.university_users.groupBy({
              by: ['university_id'],
              where: { university_id: { in: uniIds }, relationship_type: 'student' },
              _count: { _all: true },
            }),
          []
        )
      : [],
  ]);

  const cohortsByUni = new Map();
  for (const c of cohorts) {
    const list = cohortsByUni.get(c.university_id);
    if (list) list.push(c);
    else cohortsByUni.set(c.university_id, [c]);
  }
  const studentsByCohort = new Map();
  for (const row of enrollments) {
    const list = studentsByCohort.get(row.cohort_id);
    if (list) list.push(row.student_id);
    else studentsByCohort.set(row.cohort_id, [row.student_id]);
  }
  const recognitionByCohort = new Map(recognitionGroups.map((g) => [g.cohort_id, g._count._all]));
  const certificatesByCohort = new Map(certificateGroups.map((g) => [g.cohort_id, g._count._all]));
  const membershipByUni = new Map(membershipGroups.map((g) => [g.university_id, g._count._all]));

  return universities.map((uni) => {
    const uniCohorts = cohortsByUni.get(uni.id) || [];
    const studentIds = new Set();
    let recognition_count = 0;
    let certificates_count = 0;
    for (const c of uniCohorts) {
      for (const studentId of studentsByCohort.get(c.id) || []) studentIds.add(studentId);
      recognition_count += recognitionByCohort.get(c.id) || 0;
      certificates_count += certificatesByCohort.get(c.id) || 0;
    }
    const enrolled_students_count = Math.max(studentIds.size, membershipByUni.get(uni.id) || 0);
    return {
      university_id: uni.id,
      university_name: uni.name,
      status: uni.status,
      partnership_state: uni.partnership_state,
      cohorts_count: uniCohorts.length,
      active_micro_credentials: new Set(uniCohorts.map((c) => c.micro_credential_id)).size,
      enrolled_students_count,
      recognition_requests_count: recognition_count,
      certificates_count,
    };
  });
}

async function cohortsReport(filters) {
  const cohortIds = await resolveCohortIds(filters);
  const cohortWhere = cohortWhereFromIds(cohortIds, filters);
  const cohorts = await safeQuery(
    () =>
      prisma.cohorts.findMany({
        where: { ...(cohortWhere ? { id: cohortWhere } : {}) },
        select: {
          id: true,
          title: true,
          status: true,
          start_date: true,
          end_date: true,
          micro_credential_id: true,
          university_id: true,
        },
      }),
    []
  );
  if (!cohorts.length) return [];
  const ids = cohorts.map((c) => c.id);
  const [enrollments, assessmentGroups, qaGroups] = await Promise.all([
    safeQuery(
      () =>
        prisma.enrollments.findMany({
          where: { cohort_id: { in: ids } },
          select: { cohort_id: true, attendance_percentage: true, final_status: true },
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.assessments.groupBy({
          by: ['cohort_id'],
          where: { cohort_id: { in: ids } },
          _count: { _all: true },
        }),
      []
    ),
    safeQuery(
      () =>
        prisma.qa_reviews.groupBy({
          by: ['cohort_id'],
          where: { cohort_id: { in: ids }, status: { in: ['open', 'in_progress'] } },
          _count: { _all: true },
        }),
      []
    ),
  ]);
  const enrollmentsByCohort = new Map();
  for (const row of enrollments) {
    const list = enrollmentsByCohort.get(row.cohort_id);
    if (list) list.push(row);
    else enrollmentsByCohort.set(row.cohort_id, [row]);
  }
  const assessmentsByCohort = new Map(assessmentGroups.map((g) => [g.cohort_id, g._count._all]));
  const qaByCohort = new Map(qaGroups.map((g) => [g.cohort_id, g._count._all]));

  return cohorts.map((c) => {
    const cohortEnrollments = enrollmentsByCohort.get(c.id) || [];
    const avgAttendance = cohortEnrollments.length
      ? Math.round(
          (cohortEnrollments.reduce((s, e) => s + Number(e.attendance_percentage || 0), 0) /
            cohortEnrollments.length) *
            100
        ) / 100
      : 0;
    const passed = cohortEnrollments.filter((e) => e.final_status === 'passed').length;
    const completed = cohortEnrollments.filter((e) => ['passed', 'failed'].includes(e.final_status)).length;
    return {
      cohort_id: c.id,
      cohort_title: c.title,
      cohort_status: c.status,
      university_id: c.university_id,
      micro_credential_id: c.micro_credential_id,
      start_date: c.start_date,
      end_date: c.end_date,
      enrollments_count: cohortEnrollments.length,
      attendance_avg_pct: avgAttendance,
      assessments_count: assessmentsByCohort.get(c.id) || 0,
      grade_pass_rate_pct: completed ? Math.round((passed / completed) * 10000) / 100 : 0,
      open_qa_reviews_count: qaByCohort.get(c.id) || 0,
    };
  });
}

async function attendanceReport(filters) {
  const cohortIds = await resolveCohortIds(filters);
  const cohortWhere = cohortWhereFromIds(cohortIds, filters);
  return safeQuery(
    () =>
      prisma.enrollments.findMany({
        where: {
          ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
          ...inDateRange('enrolled_at', filters),
        },
        select: {
          id: true,
          cohort_id: true,
          student_id: true,
          enrollment_status: true,
          attendance_percentage: true,
        },
      }),
    []
  );
}

async function assessmentsReport(filters) {
  const cohortIds = await resolveCohortIds(filters);
  const cohortWhere = cohortWhereFromIds(cohortIds, filters);
  const assessments = await safeQuery(
    () =>
      prisma.assessments.findMany({
        where: {
          ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
          ...inDateRange('due_date', filters),
        },
        select: {
          id: true,
          title: true,
          cohort_id: true,
          micro_credential_id: true,
          assessment_type: true,
          status: true,
          due_date: true,
        },
      }),
    []
  );
  const ids = assessments.map((a) => a.id);
  const [subs, grades] = await Promise.all([
    ids.length
      ? safeQuery(
          () =>
            prisma.submissions.groupBy({
              by: ['assessment_id'],
              where: { assessment_id: { in: ids } },
              _count: { _all: true },
            }),
          []
        )
      : [],
    ids.length
      ? safeQuery(
          () =>
            prisma.grades.groupBy({
              by: ['assessment_id'],
              where: { assessment_id: { in: ids } },
              _count: { _all: true },
              _avg: { score: true },
            }),
          []
        )
      : [],
  ]);
  const subMap = new Map(subs.map((r) => [r.assessment_id, r._count._all]));
  const gradeMap = new Map(grades.map((r) => [r.assessment_id, { count: r._count._all, avg: Number(r._avg.score || 0) }]));
  return assessments.map((a) => ({
    assessment_id: a.id,
    title: a.title,
    cohort_id: a.cohort_id,
    micro_credential_id: a.micro_credential_id,
    assessment_type: a.assessment_type,
    status: a.status,
    due_date: a.due_date,
    submissions_count: subMap.get(a.id) || 0,
    grades_count: gradeMap.get(a.id)?.count || 0,
    average_score: gradeMap.get(a.id)?.avg || 0,
  }));
}

async function recognitionReport(filters) {
  const cohortIds = await resolveCohortIds(filters);
  const cohortWhere = cohortWhereFromIds(cohortIds, filters);
  const requests = await safeQuery(
    () =>
      prisma.recognition_requests.findMany({
        where: {
          ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
          ...inDateRange('created_at', filters),
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          university_id: true,
          micro_credential_id: true,
          cohort_id: true,
          created_by: true,
          status: true,
          submitted_at: true,
          reviewed_at: true,
          created_at: true,
        },
      }),
    []
  );
  const requestIds = requests.map((r) => r.id);
  const docs = requestIds.length
    ? await safeQuery(
        () =>
          prisma.recognition_documents.findMany({
            where: { recognition_request_id: { in: requestIds } },
            select: { recognition_request_id: true, document_type: true },
          }),
        []
      )
    : [];
  const byReq = new Map();
  for (const d of docs) {
    if (!byReq.has(d.recognition_request_id)) byReq.set(d.recognition_request_id, []);
    byReq.get(d.recognition_request_id).push(d.document_type);
  }
  return requests.map((r) => {
    const reqDocs = byReq.get(r.id) || [];
    return {
      recognition_request_id: r.id,
      university_id: r.university_id,
      micro_credential_id: r.micro_credential_id,
      cohort_id: r.cohort_id,
      created_by: r.created_by,
      status: r.status,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      documents_count: reqDocs.length,
      has_credential_description: reqDocs.includes('credential_description'),
      has_alignment_matrix: reqDocs.includes('alignment_matrix'),
    };
  });
}

async function certificatesReport(filters) {
  const cohortIds = await resolveCohortIds(filters);
  const cohortWhere = cohortWhereFromIds(cohortIds, filters);
  const certs = await safeQuery(
    () =>
      prisma.certificates.findMany({
        where: {
          ...(cohortWhere ? { cohort_id: cohortWhere } : {}),
          ...inDateRange('issued_at', filters),
        },
        orderBy: { issued_at: 'desc' },
        select: {
          id: true,
          certificate_no: true,
          issued_at: true,
          status: true,
          student_id: true,
          cohort_id: true,
          micro_credential_id: true,
        },
      }),
    []
  );
  const cohortIdsForCerts = [...new Set(certs.map((c) => c.cohort_id))];
  const cohorts = cohortIdsForCerts.length
    ? await safeQuery(
        () =>
          prisma.cohorts.findMany({
            where: { id: { in: cohortIdsForCerts } },
            select: { id: true, university_id: true, title: true },
          }),
        []
      )
    : [];
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  return certs.map((c) => ({
    certificate_id: c.id,
    certificate_no: c.certificate_no,
    issued_at: c.issued_at,
    status: c.status,
    student_id: c.student_id,
    cohort_id: c.cohort_id,
    cohort_title: cohortMap.get(c.cohort_id)?.title ?? null,
    university_id: cohortMap.get(c.cohort_id)?.university_id ?? null,
    micro_credential_id: c.micro_credential_id,
  }));
}

module.exports = {
  universitiesReport,
  cohortsReport,
  attendanceReport,
  assessmentsReport,
  recognitionReport,
  certificatesReport,
};
