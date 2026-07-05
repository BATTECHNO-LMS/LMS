const { prisma } = require('../../config/db');
const repo = require('./analytics.repository');
const analyticsService = require('./analytics.service');
const { isMissingPrismaModelTableError } = require('./prismaMissingTable.js');

function inDateRange(field, filters) {
  if (!filters.from && !filters.to) return {};
  return {
    [field]: {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    },
  };
}

function cohortWhere(scope, filters) {
  if (scope.cohortIds.length) return { cohort_id: { in: scope.cohortIds } };
  if (repo.hasScopedCohortFilter(filters)) return { cohort_id: { in: [] } };
  return {};
}

function fmtDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().replace('T', ' ').slice(0, 19);
}

async function loadLookupMaps(scope) {
  const uniIds = [...new Set(scope.cohorts.map((c) => c.university_id).filter(Boolean))];
  const mcIds = [...new Set(scope.cohorts.map((c) => c.micro_credential_id).filter(Boolean))];
  const cohortIds = scope.cohortIds;

  const [universities, mcs, tracks, cohortsFull] = await Promise.all([
    uniIds.length
      ? prisma.universities.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } })
      : prisma.universities.findMany({ select: { id: true, name: true } }),
    mcIds.length
      ? prisma.micro_credentials.findMany({
          where: { id: { in: mcIds } },
          select: { id: true, title: true, code: true, track_id: true },
        })
      : [],
    prisma.tracks.findMany({ select: { id: true, name: true } }),
    cohortIds.length
      ? prisma.cohorts.findMany({
          where: { id: { in: cohortIds } },
          select: {
            id: true,
            title: true,
            status: true,
            university_id: true,
            micro_credential_id: true,
            instructor_id: true,
            start_date: true,
            end_date: true,
          },
        })
      : [],
  ]);

  return {
    uniName: new Map(universities.map((u) => [u.id, u.name])),
    mcTitle: new Map(mcs.map((m) => [m.id, m.title])),
    mcCode: new Map(mcs.map((m) => [m.id, m.code])),
    mcTrack: new Map(mcs.map((m) => [m.id, m.track_id])),
    trackName: new Map(tracks.map((t) => [t.id, t.name])),
    cohortMap: new Map(cohortsFull.map((c) => [c.id, c])),
  };
}

async function loadUserNames(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.users.findMany({
    where: { id: { in: ids } },
    select: { id: true, full_name: true, email: true },
  });
  return new Map(rows.map((u) => [u.id, u.full_name || u.email]));
}

async function loadUserRolesMap(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const userRoles = await prisma.user_roles.findMany({
    where: { user_id: { in: ids } },
    select: { user_id: true, role_id: true },
  });
  const roleIds = [...new Set(userRoles.map((r) => r.role_id))];
  const roles = roleIds.length
    ? await prisma.roles.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true, code: true } })
    : [];
  const roleMap = new Map(roles.map((r) => [r.id, r.name || r.code]));
  const out = new Map();
  for (const ur of userRoles) {
    const label = roleMap.get(ur.role_id);
    if (!label) continue;
    if (!out.has(ur.user_id)) out.set(ur.user_id, label);
  }
  return out;
}

async function getExtendedUniversitiesPerformance(filters, scope, lookups) {
  const baseRows = await repo.getUniversitiesReportRows(filters);
  const uniIds = baseRows.map((r) => r.university_id);

  const [roles, userRoles, uniUsers, qaCounts, integrityCounts] = await Promise.all([
    prisma.roles.findMany({ select: { id: true, code: true } }),
    prisma.user_roles.findMany({ select: { user_id: true, role_id: true } }),
    uniIds.length
      ? prisma.university_users.findMany({
          where: { university_id: { in: uniIds } },
          select: { university_id: true, user_id: true, relationship_type: true },
        })
      : [],
    uniIds.length
      ? prisma.qa_reviews.groupBy({
          by: ['cohort_id'],
          where: {
            cohort_id: { in: scope.cohortIds.filter((id) => scope.cohorts.some((c) => c.university_id && c.id === id)) },
            ...inDateRange('created_at', filters),
          },
          _count: { _all: true },
        })
      : [],
    uniIds.length
      ? prisma.integrity_cases.groupBy({
          by: ['cohort_id'],
          where: {
            cohort_id: { in: scope.cohortIds },
            status: { in: ['reported', 'under_investigation'] },
            ...inDateRange('created_at', filters),
          },
          _count: { _all: true },
        })
      : [],
  ]);

  const roleCodeMap = new Map(roles.map((r) => [r.id, r.code]));
  const userRoleCodes = new Map();
  for (const ur of userRoles) {
    const code = roleCodeMap.get(ur.role_id);
    if (!code) continue;
    if (!userRoleCodes.has(ur.user_id)) userRoleCodes.set(ur.user_id, new Set());
    userRoleCodes.get(ur.user_id).add(code);
  }

  const cohortToUni = new Map(scope.cohorts.map((c) => [c.id, c.university_id]));
  const qaByUni = new Map();
  for (const row of qaCounts) {
    const uniId = cohortToUni.get(row.cohort_id);
    if (!uniId) continue;
    qaByUni.set(uniId, (qaByUni.get(uniId) || 0) + row._count._all);
  }
  const integrityByUni = new Map();
  for (const row of integrityCounts) {
    const uniId = cohortToUni.get(row.cohort_id);
    if (!uniId) continue;
    integrityByUni.set(uniId, (integrityByUni.get(uniId) || 0) + row._count._all);
  }

  const mcByUni = new Map();
  for (const c of scope.cohorts) {
    if (!c.university_id || !c.micro_credential_id) continue;
    if (!mcByUni.has(c.university_id)) mcByUni.set(c.university_id, new Set());
    mcByUni.get(c.university_id).add(c.micro_credential_id);
  }

  const usersByUni = new Map();
  const studentsByUni = new Map();
  const instructorsByUni = new Map();
  for (const uu of uniUsers) {
    usersByUni.set(uu.university_id, (usersByUni.get(uu.university_id) || 0) + 1);
    if (uu.relationship_type === 'student') {
      studentsByUni.set(uu.university_id, (studentsByUni.get(uu.university_id) || 0) + 1);
    }
    if (uu.relationship_type === 'instructor') {
      instructorsByUni.set(uu.university_id, (instructorsByUni.get(uu.university_id) || 0) + 1);
    }
  }

  const enrollByUni = new Map();
  if (scope.cohortIds.length) {
    const enrollRows = await prisma.enrollments.findMany({
      where: { cohort_id: { in: scope.cohortIds }, ...inDateRange('enrolled_at', filters) },
      select: { cohort_id: true, student_id: true },
    });
    for (const e of enrollRows) {
      const uniId = cohortToUni.get(e.cohort_id);
      if (!uniId) continue;
      if (!enrollByUni.has(uniId)) enrollByUni.set(uniId, new Set());
      enrollByUni.get(uniId).add(e.student_id);
    }
  }

  return baseRows.map((u) => ({
    university: lookups.uniName.get(u.university_id) || u.name,
    usersCount: usersByUni.get(u.university_id) || 0,
    studentsCount: enrollByUni.get(u.university_id)?.size ?? u.students ?? 0,
    instructorsCount: instructorsByUni.get(u.university_id) || 0,
    cohortsCount: u.cohorts,
    microCredentialsCount: mcByUni.get(u.university_id)?.size || 0,
    enrollmentsCount: enrollByUni.get(u.university_id)?.size || u.students || 0,
    attendanceRatePct: u.attendanceRatePct,
    certificatesIssued: u.certificatesIssued,
    recognitionRequests: u.recognitionRequests,
    qaIssues: qaByUni.get(u.university_id) || 0,
    integrityIssues: integrityByUni.get(u.university_id) || 0,
    notes: '',
  }));
}

async function getEnrollmentExportRows(filters, scope, lookups) {
  const where = {
    ...cohortWhere(scope, filters),
    ...inDateRange('enrolled_at', filters),
  };
  const rows = await prisma.enrollments.findMany({
    where,
    select: {
      enrollment_status: true,
      enrolled_at: true,
      approved_at: true,
      rejection_reason: true,
      cohort_id: true,
      student_id: true,
    },
    orderBy: { enrolled_at: 'desc' },
    take: 5000,
  });

  const studentIds = rows.map((r) => r.student_id);
  const userMap = await loadUserNames(studentIds);
  const userEmails = studentIds.length
    ? await prisma.users.findMany({ where: { id: { in: studentIds } }, select: { id: true, email: true } })
    : [];
  const emailMap = new Map(userEmails.map((u) => [u.id, u.email]));

  const statusSummary = await repo.getEnrollmentStatusDistribution(filters);
  const inactiveCount = await prisma.enrollments.count({
    where: {
      ...cohortWhere(scope, filters),
      enrollment_status: { in: ['withdrawn', 'cancelled'] },
      ...inDateRange('enrolled_at', filters),
    },
  });

  const summary = {
    pending: statusSummary.find((s) => s.status === 'pending')?.count || 0,
    enrolled: (statusSummary.find((s) => s.status === 'enrolled')?.count || 0)
      + (statusSummary.find((s) => s.status === 'completed')?.count || 0),
    rejected: statusSummary.find((s) => s.status === 'rejected')?.count || 0,
    inactive: inactiveCount,
  };

  const tableRows = rows.map((r) => {
    const cohort = lookups.cohortMap.get(r.cohort_id);
    return {
      university: lookups.uniName.get(cohort?.university_id) || 'غير متوفر',
      cohort: cohort?.title || r.cohort_id,
      microCredential: lookups.mcTitle.get(cohort?.micro_credential_id) || 'غير متوفر',
      student: userMap.get(r.student_id) || r.student_id,
      email: emailMap.get(r.student_id) || '',
      enrollmentStatus: r.enrollment_status,
      enrolledAt: fmtDate(r.enrolled_at),
      approvedAt: fmtDate(r.approved_at),
      notes: r.rejection_reason || '',
    };
  });

  return { summary, rows: tableRows };
}

async function getCohortsSessionsRows(filters, scope, lookups) {
  const cohortIds = scope.cohortIds;
  if (!cohortIds.length && repo.hasScopedCohortFilter(filters)) return [];

  const cohorts = cohortIds.length
    ? await prisma.cohorts.findMany({
        where: { id: { in: cohortIds } },
        select: {
          id: true,
          title: true,
          status: true,
          university_id: true,
          micro_credential_id: true,
          instructor_id: true,
          start_date: true,
          end_date: true,
        },
      })
    : await prisma.cohorts.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          university_id: true,
          micro_credential_id: true,
          instructor_id: true,
          start_date: true,
          end_date: true,
        },
        take: 500,
      });

  const ids = cohorts.map((c) => c.id);
  const [sessionCounts, studentCounts, instructorMap] = await Promise.all([
    ids.length
      ? prisma.sessions.groupBy({
          by: ['cohort_id'],
          where: { cohort_id: { in: ids }, ...inDateRange('session_date', filters) },
          _count: { _all: true },
        })
      : [],
    ids.length
      ? prisma.enrollments.groupBy({
          by: ['cohort_id'],
          where: { cohort_id: { in: ids }, enrollment_status: { in: ['enrolled', 'completed'] } },
          _count: { _all: true },
        })
      : [],
    loadUserNames(cohorts.map((c) => c.instructor_id)),
  ]);

  const sessionMap = new Map(sessionCounts.map((s) => [s.cohort_id, s._count._all]));
  const studentMap = new Map(studentCounts.map((s) => [s.cohort_id, s._count._all]));

  return cohorts.map((c) => {
    const trackId = lookups.mcTrack.get(c.micro_credential_id);
    const totalSessions = sessionMap.get(c.id) || 0;
    const completedSessions = totalSessions;
    const completionPct = totalSessions ? Math.round((completedSessions / totalSessions) * 10000) / 100 : null;
    return {
      university: lookups.uniName.get(c.university_id) || 'غير متوفر',
      track: trackId ? lookups.trackName.get(trackId) || 'غير متوفر' : 'غير متوفر',
      microCredential: lookups.mcTitle.get(c.micro_credential_id) || 'غير متوفر',
      cohort: c.title,
      status: c.status,
      instructor: c.instructor_id ? instructorMap.get(c.instructor_id) || 'غير متوفر' : 'غير متوفر',
      startDate: fmtDate(c.start_date),
      endDate: fmtDate(c.end_date),
      studentsCount: studentMap.get(c.id) || 0,
      sessionsCount: totalSessions,
      completionPct,
    };
  });
}

async function getAttendanceExportData(filters, scope, lookups) {
  const scopedCohorts = scope.cohortIds.length
    ? { in: scope.cohortIds }
    : repo.hasScopedCohortFilter(filters)
      ? { in: [] }
      : undefined;

  const sessions = await prisma.sessions.findMany({
    where: {
      ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
      ...inDateRange('session_date', filters),
    },
    select: { id: true, title: true, session_date: true, cohort_id: true },
    orderBy: { session_date: 'desc' },
    take: 500,
  });

  let records = [];
  if (sessions.length) {
    try {
      records = await prisma.attendance_records.findMany({
        where: { session_id: { in: sessions.map((s) => s.id) } },
        select: { session_id: true, student_id: true, attendance_status: true, notes: true },
        take: 5000,
      });
    } catch (e) {
      if (!isMissingPrismaModelTableError(e, 'attendance_records')) throw e;
    }
  }

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const studentIds = records.map((r) => r.student_id);
  const userMap = await loadUserNames(studentIds);

  const statusLabels = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    excused: 'بعذر',
  };

  const rows = records.map((r) => {
    const session = sessionMap.get(r.session_id);
    const cohort = session ? lookups.cohortMap.get(session.cohort_id) : null;
    return {
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      cohort: cohort?.title || 'غير متوفر',
      session: session?.title || r.session_id,
      sessionDate: session ? fmtDate(session.session_date) : '',
      student: userMap.get(r.student_id) || r.student_id,
      status: r.attendance_status,
      statusLabel: statusLabels[r.attendance_status] || r.attendance_status,
      notes: r.notes || '',
    };
  });

  const attendanceAnalytics = await repo.getAttendanceAnalytics(filters);
  const totalRecords = Object.values(attendanceAnalytics.statusBreakdown || {}).reduce((s, v) => s + v, 0);
  const attended =
    (attendanceAnalytics.statusBreakdown?.present || 0)
    + (attendanceAnalytics.statusBreakdown?.late || 0)
    + (attendanceAnalytics.statusBreakdown?.excused || 0);
  const overallRate = totalRecords ? Math.round((attended / totalRecords) * 10000) / 100 : null;

  const uniRows = await repo.getUniversitiesReportRows(filters);
  const byUniversity = uniRows
    .filter((u) => u.attendanceRatePct != null)
    .map((u) => ({
      university: lookups.uniName.get(u.university_id) || u.name,
      ratePct: u.attendanceRatePct,
    }));

  const lowWarnings = [];
  if (attendanceAnalytics.lowAttendanceCohorts?.length) {
    const cohortIds = attendanceAnalytics.lowAttendanceCohorts.map((r) => r.cohort_id);
    const cohortRows = await prisma.cohorts.findMany({
      where: { id: { in: cohortIds } },
      select: { id: true, title: true, university_id: true },
    });
    const cMap = new Map(cohortRows.map((c) => [c.id, c]));
    for (const item of attendanceAnalytics.lowAttendanceCohorts) {
      const c = cMap.get(item.cohort_id);
      lowWarnings.push({
        university: c ? lookups.uniName.get(c.university_id) || '' : '',
        cohort: c?.title || item.cohort_id,
        lowCount: item.low_count,
      });
    }
  }

  return {
    summary: { overallRate, byUniversity, lowWarnings },
    rows,
  };
}

async function getAssessmentsExportRows(filters, scope, lookups) {
  const where = {
    ...cohortWhere(scope, filters),
    ...inDateRange('due_date', filters),
  };

  let assessments = [];
  try {
    assessments = await prisma.assessments.findMany({
      where,
      select: {
        id: true,
        title: true,
        assessment_type: true,
        status: true,
        due_date: true,
        cohort_id: true,
      },
      orderBy: { due_date: 'desc' },
      take: 500,
    });
  } catch (e) {
    if (!isMissingPrismaModelTableError(e, 'assessments')) throw e;
    return [];
  }

  const ids = assessments.map((a) => a.id);
  const [subCounts, gradeCounts, gradeAvgs] = await Promise.all([
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
    ids.length
      ? prisma.grades.groupBy({
          by: ['assessment_id'],
          where: { assessment_id: { in: ids } },
          _avg: { score: true },
        })
      : [],
  ]);

  const subMap = new Map(subCounts.map((r) => [r.assessment_id, r._count._all]));
  const gradeMap = new Map(gradeCounts.map((r) => [r.assessment_id, r._count._all]));
  const avgMap = new Map(gradeAvgs.map((r) => [r.assessment_id, r._avg.score]));
  const now = new Date();

  return assessments.map((a) => {
    const cohort = lookups.cohortMap.get(a.cohort_id);
    const subs = subMap.get(a.id) || 0;
    const grades = gradeMap.get(a.id) || 0;
    const overdue = a.due_date && new Date(a.due_date) < now && ['published', 'open'].includes(a.status);
    const pendingGrading = subs > grades;
    const delayed = overdue && (pendingGrading || ['published', 'open'].includes(a.status));
    return {
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      cohort: cohort?.title || a.cohort_id,
      assessment: a.title,
      assessmentType: a.assessment_type,
      status: a.status,
      dueDate: fmtDate(a.due_date),
      submissionsCount: subs,
      gradesCount: grades,
      avgScore: avgMap.get(a.id) != null ? Math.round(Number(avgMap.get(a.id)) * 100) / 100 : null,
      delayedCount: delayed ? 1 : 0,
      notes: '',
    };
  });
}

async function getQaRiskExportRows(filters, scope, lookups) {
  const cohortFilter = scope.cohortIds.length
    ? { in: scope.cohortIds }
    : repo.hasScopedCohortFilter(filters)
      ? { in: [] }
      : undefined;

  const [qaReviews, correctiveActions, riskCases, integrityCases, evidenceAnalytics] = await Promise.all([
    prisma.qa_reviews.findMany({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        ...inDateRange('created_at', filters),
      },
      select: {
        id: true,
        cohort_id: true,
        reviewer_id: true,
        review_type: true,
        status: true,
        created_at: true,
        updated_at: true,
        findings: true,
      },
      take: 500,
      orderBy: { created_at: 'desc' },
    }),
    prisma.corrective_actions.findMany({
      where: { ...inDateRange('created_at', filters) },
      select: {
        id: true,
        assigned_to: true,
        action_text: true,
        status: true,
        due_date: true,
        closed_at: true,
        created_at: true,
      },
      take: 500,
      orderBy: { created_at: 'desc' },
    }),
    prisma.risk_cases.findMany({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        ...inDateRange('created_at', filters),
      },
      select: {
        id: true,
        cohort_id: true,
        risk_type: true,
        risk_level: true,
        status: true,
        opened_by: true,
        created_at: true,
        updated_at: true,
        action_plan: true,
      },
      take: 500,
      orderBy: { created_at: 'desc' },
    }),
    prisma.integrity_cases.findMany({
      where: {
        ...(cohortFilter ? { cohort_id: cohortFilter } : {}),
        ...inDateRange('created_at', filters),
      },
      select: {
        id: true,
        cohort_id: true,
        case_type: true,
        status: true,
        reported_by: true,
        created_at: true,
        updated_at: true,
        evidence_notes: true,
      },
      take: 500,
      orderBy: { created_at: 'desc' },
    }),
    repo.getEvidenceAnalytics(filters),
  ]);

  const userIds = [
    ...qaReviews.map((r) => r.reviewer_id),
    ...correctiveActions.map((r) => r.assigned_to),
    ...riskCases.map((r) => r.opened_by),
    ...integrityCases.map((r) => r.reported_by),
  ];
  const userMap = await loadUserNames(userIds);

  const qaRows = qaReviews.map((r) => {
    const cohort = lookups.cohortMap.get(r.cohort_id);
    return {
      section: 'مراجعة الجودة',
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      cohort: cohort?.title || r.cohort_id,
      type: r.review_type,
      status: r.status,
      priority: 'غير متوفر',
      assignee: r.reviewer_id ? userMap.get(r.reviewer_id) || 'غير متوفر' : 'غير متوفر',
      createdAt: fmtDate(r.created_at),
      closedAt: r.status === 'closed' ? fmtDate(r.updated_at) : '',
      notes: r.findings || '',
    };
  });

  const missingEvidenceRows = evidenceAnalytics.missingEvidence
    ? [{
        section: 'أدلة ناقصة',
        university: '—',
        cohort: '—',
        type: 'missing_evidence',
        status: 'open',
        priority: 'متوسط',
        assignee: 'غير متوفر',
        createdAt: fmtDate(new Date()),
        closedAt: '',
        notes: `عدد الجلسات بدون أدلة: ${evidenceAnalytics.missingEvidence}`,
      }]
    : [];

  const correctiveRows = correctiveActions.map((r) => ({
    section: 'إجراءات تصحيحية',
    university: '—',
    cohort: '—',
    type: 'corrective_action',
    status: r.status,
    priority: r.status === 'overdue' ? 'عالي' : 'متوسط',
    assignee: r.assigned_to ? userMap.get(r.assigned_to) || 'غير متوفر' : 'غير متوفر',
    createdAt: fmtDate(r.created_at),
    closedAt: fmtDate(r.closed_at),
    notes: r.action_text?.slice(0, 200) || '',
  }));

  const riskRows = riskCases.map((r) => {
    const cohort = lookups.cohortMap.get(r.cohort_id);
    return {
      section: 'حالات مخاطر',
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      cohort: cohort?.title || r.cohort_id,
      type: r.risk_type,
      status: r.status,
      priority: r.risk_level,
      assignee: r.opened_by ? userMap.get(r.opened_by) || 'غير متوفر' : 'غير متوفر',
      createdAt: fmtDate(r.created_at),
      closedAt: ['resolved', 'closed'].includes(r.status) ? fmtDate(r.updated_at) : '',
      notes: r.action_plan?.slice(0, 200) || '',
    };
  });

  const integrityRows = integrityCases.map((r) => {
    const cohort = lookups.cohortMap.get(r.cohort_id);
    return {
      section: 'قضايا النزاهة',
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      cohort: cohort?.title || r.cohort_id,
      type: r.case_type,
      status: r.status,
      priority: 'عالي',
      assignee: r.reported_by ? userMap.get(r.reported_by) || 'غير متوفر' : 'غير متوفر',
      createdAt: fmtDate(r.created_at),
      closedAt: ['resolved', 'closed'].includes(r.status) ? fmtDate(r.updated_at) : '',
      notes: r.evidence_notes?.slice(0, 200) || '',
    };
  });

  return [...qaRows, ...missingEvidenceRows, ...correctiveRows, ...riskRows, ...integrityRows];
}

async function getCertificatesExportRows(filters, scope, lookups) {
  const scopedCohorts = scope.cohortIds.length
    ? { in: scope.cohortIds }
    : repo.hasScopedCohortFilter(filters)
      ? { in: [] }
      : undefined;

  let certs = [];
  try {
    certs = await prisma.certificates.findMany({
      where: {
        ...(scopedCohorts ? { cohort_id: scopedCohorts } : {}),
        ...inDateRange('issued_at', filters),
      },
      select: {
        certificate_no: true,
        verification_code: true,
        status: true,
        issued_at: true,
        student_id: true,
        cohort_id: true,
        micro_credential_id: true,
      },
      orderBy: { issued_at: 'desc' },
      take: 5000,
    });
  } catch (e) {
    if (!isMissingPrismaModelTableError(e, 'certificates')) throw e;
    return [];
  }

  const studentMap = await loadUserNames(certs.map((c) => c.student_id));

  return certs.map((c) => {
    const cohort = lookups.cohortMap.get(c.cohort_id);
    return {
      university: cohort ? lookups.uniName.get(cohort.university_id) || 'غير متوفر' : 'غير متوفر',
      student: studentMap.get(c.student_id) || c.student_id,
      microCredential: lookups.mcTitle.get(c.micro_credential_id) || 'غير متوفر',
      cohort: cohort?.title || c.cohort_id,
      certificateNo: c.certificate_no,
      status: c.status,
      issuedAt: fmtDate(c.issued_at),
      verificationCode: c.verification_code,
      verificationStatus: c.status === 'issued' ? 'صالح' : c.status,
      notes: '',
    };
  });
}

async function getFieldTrainingExportRows(filters, lookups) {
  const fieldTraining = await repo.getFieldTrainingAnalytics(filters);
  if (!fieldTraining.available) {
    return { available: false, rows: [] };
  }

  const universityWhere = filters.university_id ? { university_id: filters.university_id } : {};
  const dateWhere = inDateRange('created_at', filters);

  let opportunities = [];
  try {
    opportunities = await prisma.field_training_opportunities.findMany({
      where: { ...universityWhere, ...dateWhere },
      select: {
        id: true,
        title: true,
        specialty_id: true,
        location: true,
        training_mode: true,
        status: true,
        seats_limit: true,
        updated_at: true,
        specialties: { select: { name_ar: true, name_en: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: 500,
    });
  } catch (e) {
    if (!isMissingPrismaModelTableError(e, 'field_training_opportunities')) throw e;
    return { available: false, rows: [] };
  }

  const rows = [];
  for (const opp of opportunities) {
    const [appCount, taskCount, subCount] = await Promise.all([
      prisma.field_training_applications.count({ where: { opportunity_id: opp.id, ...dateWhere } }),
      prisma.field_training_tasks.count({ where: { opportunity_id: opp.id } }),
      prisma.field_training_task_submissions.count({
        where: {
          field_training_applications: { opportunity_id: opp.id },
          ...inDateRange('submitted_at', filters),
        },
      }),
    ]);
    rows.push({
      specialty:
        opp.specialties?.name_ar || opp.specialties?.name_en || 'غير محدد',
      opportunity: opp.title,
      trainingMode: opp.training_mode,
      status: opp.status,
      location: opp.location,
      seatsLimit: opp.seats_limit,
      applicationsCount: appCount,
      tasksCount: taskCount,
      submissionsCount: subCount,
      lastUpdated: fmtDateTime(opp.updated_at),
    });
  }

  return { available: true, rows };
}

async function getNotificationsActivityRows(filters, scope) {
  const uniFilter = filters.university_id ? { primary_university_id: filters.university_id } : {};
  const userWhere = Object.keys(uniFilter).length ? uniFilter : {};

  const usersInScope = Object.keys(userWhere).length
    ? await prisma.users.findMany({ where: userWhere, select: { id: true } })
    : null;
  const userIds = usersInScope ? usersInScope.map((u) => u.id) : null;

  const notifWhere = {
    ...inDateRange('created_at', filters),
    ...(userIds ? { user_id: { in: userIds } } : {}),
  };

  const [notifications, auditLogs] = await Promise.all([
    prisma.notifications.findMany({
      where: notifWhere,
      select: {
        created_at: true,
        user_id: true,
        title: true,
        body: true,
        type: true,
        is_read: true,
        action_url: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.audit_logs.findMany({
      where: {
        ...inDateRange('created_at', filters),
        ...(filters.university_id ? { university_id: filters.university_id } : {}),
      },
      select: {
        created_at: true,
        user_id: true,
        action_type: true,
        entity_type: true,
        entity_id: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
  ]);

  const allUserIds = [
    ...notifications.map((n) => n.user_id),
    ...auditLogs.map((a) => a.user_id),
  ];
  const [userMap, roleMap] = await Promise.all([
    loadUserNames(allUserIds),
    loadUserRolesMap(allUserIds),
  ]);

  const notifRows = notifications.map((n) => ({
    source: 'إشعار',
    date: fmtDateTime(n.created_at),
    user: userMap.get(n.user_id) || n.user_id,
    role: roleMap.get(n.user_id) || 'غير متوفر',
    type: n.type,
    title: n.title,
    status: n.is_read ? 'مقروء' : 'غير مقروء',
    actionUrl: n.action_url || '',
    action: '',
    entity: n.body?.slice(0, 100) || '',
  }));

  const auditRows = auditLogs.map((a) => ({
    source: 'سجل تدقيق',
    date: fmtDateTime(a.created_at),
    user: a.user_id ? userMap.get(a.user_id) || a.user_id : 'النظام',
    role: a.user_id ? roleMap.get(a.user_id) || 'غير متوفر' : 'النظام',
    type: a.entity_type,
    title: a.action_type,
    status: '—',
    actionUrl: '',
    action: a.action_type,
    entity: a.entity_type + (a.entity_id ? ` (${a.entity_id})` : ''),
  }));

  return [...notifRows, ...auditRows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

async function getRawDataRows(filters, scope, lookups, overview) {
  const rows = [];

  for (const u of overview.universitiesOverview || []) {
    rows.push({
      category: 'university_overview',
      key: u.university_id || u.id,
      label: u.name || u.nameAr || u.nameEn,
      value: u.students,
      extra: JSON.stringify({ cohorts: u.cohorts, recognition: u.recognitionRequests }),
    });
  }

  for (const item of overview.enrollmentGrowth || []) {
    rows.push({
      category: 'enrollment_growth',
      key: item.monthKey,
      label: item.monthKey,
      value: item.enrollments,
      extra: '',
    });
  }

  for (const item of overview.cohortStatus || []) {
    rows.push({
      category: 'cohort_status',
      key: item.statusKey,
      label: item.statusKey,
      value: item.count,
      extra: '',
    });
  }

  for (const item of overview.assessmentHealth || []) {
    rows.push({
      category: 'assessment_health',
      key: item.key,
      label: item.key,
      value: item.value,
      extra: '',
    });
  }

  const kpiEntries = Object.entries(overview.kpis || {});
  for (const [key, value] of kpiEntries) {
    rows.push({
      category: 'kpi',
      key,
      label: key,
      value,
      extra: '',
    });
  }

  return rows;
}

async function resolveUniversityName(universityId) {
  if (!universityId) return null;
  const row = await prisma.universities.findUnique({
    where: { id: universityId },
    select: { name: true },
  });
  return row?.name ?? null;
}

async function resolveGeneratorProfile(userId) {
  if (!userId) return { name: null, role: null };
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { full_name: true, email: true },
  });
  if (!user) return { name: null, role: null };
  const userRoles = await prisma.user_roles.findMany({
    where: { user_id: userId },
    select: { role_id: true },
  });
  const roleIds = userRoles.map((r) => r.role_id);
  const roleRows = roleIds.length
    ? await prisma.roles.findMany({ where: { id: { in: roleIds } }, select: { code: true, name: true } })
    : [];
  const primaryRole = roleRows[0]?.name || roleRows[0]?.code || null;
  return { name: user.full_name || user.email, role: primaryRole };
}

/**
 * Fetch all data needed for the analytics Excel export workbook.
 * @param {import('./analytics.validation').AnalyticsFilters} filters
 * @param {{ userId?: string }} authUser
 */
async function fetchExcelExportData(filters, authUser = {}) {
  const scope = await repo.resolveCohortScope(filters);
  const lookups = await loadLookupMaps(scope);

  const [overview, generator, universityScopeName] = await Promise.all([
    analyticsService.getOverviewAnalytics(filters),
    resolveGeneratorProfile(authUser.userId),
    filters.university_id ? resolveUniversityName(filters.university_id) : Promise.resolve(null),
  ]);

  const [
    universitiesPerformance,
    enrollments,
    cohortsSessions,
    attendance,
    assessments,
    qaRisk,
    certificates,
    fieldTraining,
    notificationsActivity,
    rawData,
  ] = await Promise.all([
    getExtendedUniversitiesPerformance(filters, scope, lookups),
    getEnrollmentExportRows(filters, scope, lookups),
    getCohortsSessionsRows(filters, scope, lookups),
    getAttendanceExportData(filters, scope, lookups),
    getAssessmentsExportRows(filters, scope, lookups),
    getQaRiskExportRows(filters, scope, lookups),
    getCertificatesExportRows(filters, scope, lookups),
    getFieldTrainingExportRows(filters, lookups),
    getNotificationsActivityRows(filters, scope),
    getRawDataRows(filters, scope, lookups, overview),
  ]);

  return {
    generatedAt: new Date(),
    generator,
    filters,
    universityScopeName,
    overview,
    universitiesPerformance,
    enrollments,
    cohortsSessions,
    attendance,
    assessments,
    qaRisk,
    certificates,
    fieldTraining,
    notificationsActivity,
    rawData,
  };
}

module.exports = {
  fetchExcelExportData,
  fmtDate,
  fmtDateTime,
};
