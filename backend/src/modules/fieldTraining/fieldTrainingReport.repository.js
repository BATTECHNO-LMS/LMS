const { prisma } = require('../../config/db');
const repo = require('./fieldTraining.repository');
const ftEligibility = require('./fieldTraining.eligibility');
const progressBuilder = require('./fieldTraining.progress');
const hoursMod = require('./fieldTraining.hours');

function parseDateFilter(filters = {}) {
  const where = {};
  if (filters.from) where.gte = new Date(filters.from);
  if (filters.to) {
    const end = new Date(filters.to);
    if (!Number.isNaN(end.getTime()) && String(filters.to).length <= 10) {
      end.setHours(23, 59, 59, 999);
    }
    where.lte = end;
  }
  return Object.keys(where).length ? where : null;
}

async function loadUniversity(universityId) {
  return prisma.universities.findFirst({
    where: { id: universityId, status: 'active' },
    select: { id: true, name: true, name_en: true, short_name: true, code: true },
  });
}

async function studentIdsForUniversity(universityId) {
  const rows = await prisma.users.findMany({
    where: { primary_university_id: universityId },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function countEligibleOpportunities(universityId) {
  return prisma.field_training_opportunities.count({
    where: {
      status: { in: ['published', 'in_progress'] },
      field_training_opportunity_eligibility: {
        some: { university_id: universityId, is_active: true },
      },
    },
  });
}

function average(nums) {
  const values = nums.filter((n) => n != null && !Number.isNaN(Number(n)));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, n) => sum + Number(n), 0) / values.length) * 100) / 100;
}

const IN_TRAINING_STATUSES = new Set([
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'ready_for_training',
  'pre_assessment_completed',
]);

function emptyUniversitySummary(eligibleOpportunities = 0) {
  return {
    eligible_opportunities: eligibleOpportunities,
    total_applicants: 0,
    pending_review: 0,
    accepted_students: 0,
    rejected_students: 0,
    expelled_students: 0,
    in_training_students: 0,
    completed_students: 0,
    eligible_students: 0,
    completion_letters_issued: 0,
    average_attendance: null,
    average_pre_assessment_score: null,
    average_post_assessment_score: null,
    tasks_submitted: 0,
    task_submission_rate: null,
  };
}

function summarizeApplications(apps, { eligibleOpportunities = 0, submissions = 0, tasks = 0 } = {}) {
  const approved = apps.filter((app) => app.status === 'approved');
  return {
    eligible_opportunities: eligibleOpportunities,
    total_applicants: apps.length,
    pending_review: apps.filter((app) => app.status === 'pending').length,
    accepted_students: approved.length,
    rejected_students: apps.filter((app) => app.status === 'rejected').length,
    expelled_students: approved.filter((app) => app.training_status === 'expelled').length,
    in_training_students: approved.filter((app) => IN_TRAINING_STATUSES.has(app.training_status)).length,
    completed_students: approved.filter((app) => app.training_status === 'completed').length,
    eligible_students: approved.filter((app) => app.completion_eligibility_status === 'eligible').length,
    completion_letters_issued: approved.filter((app) => app.completion_letter_issued_at).length,
    average_attendance: average(approved.map((app) => app.attendance_percentage)),
    average_pre_assessment_score: average(approved.map((app) => app.pre_assessment_score)),
    average_post_assessment_score: average(approved.map((app) => app.post_assessment_score)),
    tasks_submitted: submissions,
    task_submission_rate:
      tasks > 0 && approved.length > 0
        ? Math.round((submissions / (tasks * approved.length)) * 10000) / 100
        : null,
  };
}

async function buildUniversityDashboard(universityId, filters = {}) {
  const { buildApplicationWhere } = require('./fieldTrainingGlobalReport.repository');
  const appWhere = await buildApplicationWhere({ ...filters, university_id: universityId });
  const eligibleOpportunities = await countEligibleOpportunities(universityId);

  const apps = await prisma.field_training_applications.findMany({
    where: appWhere,
    select: {
      id: true,
      status: true,
      training_status: true,
      attendance_percentage: true,
      pre_assessment_score: true,
      post_assessment_score: true,
      final_task_status: true,
      completion_eligibility_status: true,
      completion_letter_issued_at: true,
      student_id: true,
      opportunity_id: true,
    },
  });

  if (!apps.length) {
    return {
      university_id: universityId,
      summary: emptyUniversitySummary(eligibleOpportunities),
      opportunities_count: eligibleOpportunities,
      applications_count: 0,
    };
  }

  const studentIds = [...new Set(apps.map((app) => app.student_id))];
  const createdAt = parseDateFilter(filters);
  const submissions = await prisma.field_training_task_submissions.count({
    where: {
      student_id: { in: studentIds },
      ...(createdAt ? { submitted_at: createdAt } : {}),
    },
  });
  const tasks = await prisma.field_training_tasks.count({
    where: {
      field_training_opportunities: {
        field_training_opportunity_eligibility: {
          some: { university_id: universityId, is_active: true },
        },
      },
    },
  });

  const summary = summarizeApplications(apps, {
    eligibleOpportunities,
    submissions,
    tasks,
  });

  return {
    university_id: universityId,
    summary,
    opportunities_count: summary.eligible_opportunities,
    applications_count: apps.length,
  };
}

async function buildUniversityReport(universityId, filters = {}) {
  const university = await loadUniversity(universityId);
  if (!university) return null;

  const dashboard = await buildUniversityDashboard(universityId, filters);
  const { buildApplicationWhere } = require('./fieldTrainingGlobalReport.repository');
  const appWhere = await buildApplicationWhere({ ...filters, university_id: universityId });

  const apps = await prisma.field_training_applications.findMany({
    where: appWhere,
    orderBy: { created_at: 'desc' },
  });

  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((app) => app.student_id))]);
  const profileById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const opportunityIds = [...new Set(apps.map((app) => app.opportunity_id))];
  const opportunities = opportunityIds.length
    ? await prisma.field_training_opportunities.findMany({
        where: { id: { in: opportunityIds } },
        include: {
          specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
        },
      })
    : [];
  const oppById = Object.fromEntries(opportunities.map((opp) => [opp.id, opp]));

  const specialtyBreakdown = new Map();
  for (const app of apps) {
    const profile = profileById[app.student_id];
    const specialtyId = profile?.university_specialty_id ?? 'unknown';
    if (!specialtyBreakdown.has(specialtyId)) {
      specialtyBreakdown.set(specialtyId, {
        university_specialty_id: specialtyId === 'unknown' ? null : specialtyId,
        university_specialty: profile?.university_specialty ?? null,
        applicants_count: 0,
        accepted_count: 0,
        attendance_values: [],
        post_assessment_values: [],
        completion_count: 0,
        task_completed_count: 0,
      });
    }
    const row = specialtyBreakdown.get(specialtyId);
    row.applicants_count += 1;
    if (app.status === 'approved') {
      row.accepted_count += 1;
      if (app.attendance_percentage != null) row.attendance_values.push(Number(app.attendance_percentage));
      if (app.post_assessment_score != null) row.post_assessment_values.push(Number(app.post_assessment_score));
      if (app.training_status === 'completed' || app.completion_letter_issued_at) row.completion_count += 1;
      if (app.final_task_status === 'approved' || app.final_task_status === 'submitted') row.task_completed_count += 1;
    }
  }

  const by_specialty = [...specialtyBreakdown.values()].map((row) => ({
    university_specialty_id: row.university_specialty_id,
    university_specialty: row.university_specialty,
    label: repo.formatSpecialtyLabel(row.university_specialty),
    applicants_count: row.applicants_count,
    accepted_count: row.accepted_count,
    attendance_average: average(row.attendance_values),
    post_assessment_average: average(row.post_assessment_values),
    task_completion_rate:
      row.accepted_count > 0
        ? Math.round((row.task_completed_count / row.accepted_count) * 10000) / 100
        : null,
    completion_count: row.completion_count,
  }));

  const hoursByApp = await hoursMod.calculateHoursProgressForApplications(
    apps.map((app) => ({ id: app.id, opportunity_id: app.opportunity_id })),
    new Map(
      opportunities.map((opp) => [opp.id, opp.required_training_hours != null ? Number(opp.required_training_hours) : null])
    )
  );

  const students = apps.map((app) => {
    const profile = profileById[app.student_id];
    const opp = oppById[app.opportunity_id];
    const hours = hoursByApp.get(app.id) || hoursMod.buildHoursProgress({
      requiredHours: opp?.required_training_hours,
      completedMinutes: 0,
    });
    return {
      application_id: app.id,
      student_id: app.student_id,
      student_name: profile?.full_name ?? null,
      student_email: profile?.email ?? null,
      student_phone: profile?.phone ?? null,
      student_account_status: profile?.status ?? null,
      university_name: profile?.university?.name ?? university.name,
      university_specialty: profile?.university_specialty ?? null,
      university_specialty_id: profile?.university_specialty_id ?? null,
      university_specialty_label: repo.formatSpecialtyLabel(profile?.university_specialty),
      canonical_specialty: profile?.canonical_specialty ?? null,
      opportunity_id: app.opportunity_id,
      opportunity_title: opp?.title ?? null,
      training_track: repo.mapSpecialtySummary(opp?.specialties) ?? null,
      application_status: app.status,
      training_status: app.training_status,
      attendance_percentage: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      required_training_hours: hours.required_training_hours,
      completed_training_hours: hours.completed_training_hours,
      remaining_training_hours: hours.remaining_training_hours,
      hours_completion_percentage: hours.hours_completion_percentage,
      hours_completion_status: hours.hours_completion_status,
      hours_completion_status_label: hoursMod.hoursStatusLabelAr(hours.hours_completion_status),
      pre_assessment_score: app.pre_assessment_score != null ? Number(app.pre_assessment_score) : null,
      post_assessment_score: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
      final_task_status: app.final_task_status,
      eligibility_status: app.completion_eligibility_status,
      completion_letter_status: app.completion_letter_issued_at ? 'issued' : 'not_issued',
      submitted_at: app.created_at,
      progress_percentage: hours.hours_completion_percentage,
    };
  }).filter((row) => {
    if (filters.eligibility_status && row.eligibility_status !== filters.eligibility_status) {
      return false;
    }
    if (filters.search) {
      const q = String(filters.search).trim().toLowerCase();
      if (!q) return true;
      const hay = [row.student_name, row.student_email, row.opportunity_title, row.university_specialty_label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  const summary =
    filters.eligibility_status || filters.search
      ? summarizeApplications(
          apps.filter((app) => students.some((row) => row.application_id === app.id)),
          {
            eligibleOpportunities: dashboard.summary.eligible_opportunities,
            submissions: dashboard.summary.tasks_submitted,
            tasks: 0,
          }
        )
      : dashboard.summary;

  return {
    report_title: 'تقرير الجامعة للتدريب الميداني',
    university,
    summary,
    by_specialty,
    students,
  };
}

function buildTimeline(app, opp, sessions, submissions, letter, attempts) {
  const events = [];
  if (app.created_at) events.push({ at: app.created_at, key: 'application_submitted', label_ar: 'تقديم الطلب' });
  if (app.reviewed_at) {
    events.push({
      at: app.reviewed_at,
      key: app.status === 'approved' ? 'application_approved' : 'application_rejected',
      label_ar: app.status === 'approved' ? 'قبول الطلب' : 'رفض الطلب',
    });
  }
  if (app.pre_assessment_score != null || attempts.pre) {
    events.push({
      at: attempts.pre?.submitted_at ?? app.updated_at,
      key: 'pre_assessment_completed',
      label_ar: 'إكمال التقييم القبلي',
    });
  }
  if (app.training_started_at || opp.training_started_at) {
    events.push({
      at: app.training_started_at ?? opp.training_started_at,
      key: 'training_started',
      label_ar: 'بدء التدريب',
    });
  }
  for (const session of sessions) {
    if (session.attendance?.recorded_at || session.attendance?.status) {
      events.push({
        at: session.attendance?.recorded_at ?? session.session_date,
        key: `session_${session.attendance?.status ?? 'recorded'}`,
        label_ar: `جلسة: ${session.title} (${session.attendance?.status ?? '—'})`,
      });
    }
  }
  for (const submission of submissions) {
    if (submission.submitted_at) {
      events.push({
        at: submission.submitted_at,
        key: 'task_submitted',
        label_ar: `تسليم مهمة: ${submission.task_title ?? submission.task_id}`,
      });
    }
    if (submission.ai_response_inserted_text || submission.student_self_evaluation_input) {
      events.push({
        at: submission.submitted_at ?? submission.updated_at ?? app.updated_at,
        key: 'ai_self_evaluation',
        label_ar: `تقييم ذاتي بالذكاء الاصطناعي: ${submission.task_title ?? submission.task_id}`,
      });
    }
    if (submission.instructor_feedback || submission.reviewed_at) {
      events.push({
        at: submission.reviewed_at ?? submission.updated_at ?? submission.submitted_at,
        key: 'instructor_feedback',
        label_ar: `ملاحظات المدرب: ${submission.task_title ?? submission.task_id}`,
      });
    }
  }
  if (attempts.post?.submitted_at || app.post_assessment_score != null) {
    events.push({
      at: attempts.post?.submitted_at ?? app.updated_at,
      key: 'post_assessment_completed',
      label_ar: 'إكمال التقييم البعدي',
    });
  }
  if (app.completion_eligibility_status && app.completion_eligibility_status !== 'pending') {
    events.push({
      at: app.updated_at,
      key: 'eligibility_calculated',
      label_ar: `أهلية الإنهاء: ${app.completion_eligibility_status}`,
    });
  }
  if (letter?.issued_at || app.completion_letter_issued_at) {
    events.push({
      at: letter?.issued_at ?? app.completion_letter_issued_at,
      key: 'completion_letter_issued',
      label_ar: 'إصدار كتاب الإنهاء',
    });
  }
  if (app.expelled_at) {
    events.push({
      at: app.expelled_at,
      key: 'expelled',
      label_ar: 'استبعاد من التدريب',
    });
  }
  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

async function buildStudentDetailedReport(applicationId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) return null;

  const opp = await repo.findById(app.opportunity_id);
  if (!opp) return null;

  const [profiles, sessionsRaw, tasks, submissionsRaw, letter, assessments] = await Promise.all([
    repo.findStudentProfilesByIds([app.student_id]),
    repo.findSessionsByOpportunity(app.opportunity_id, { applicationId: app.id }),
    repo.findTasksByOpportunity(app.opportunity_id, { applicationId: app.id }),
    prisma.field_training_task_submissions.findMany({
      where: { application_id: app.id },
      include: {
        field_training_tasks: {
          select: {
            id: true,
            title: true,
            due_date: true,
            is_final_task: true,
            requires_ai_self_evaluation: true,
            instruction_file_name: true,
            instruction_file_path: true,
          },
        },
      },
      orderBy: { submitted_at: 'asc' },
    }),
    repo.findCompletionLetterByApplication(applicationId),
    repo.findAssessmentsByOpportunity(app.opportunity_id),
  ]);

  const profile = profiles[0] ?? null;
  const attempts = await prisma.field_training_assessment_attempts.findMany({
    where: { application_id: app.id },
    include: {
      field_training_assessments: { select: { id: true, type: true, title: true, passing_score: true } },
    },
  });
  const attemptByType = {
    pre: attempts.find((row) => row.field_training_assessments?.type === 'pre') ?? null,
    post: attempts.find((row) => row.field_training_assessments?.type === 'post') ?? null,
  };

  const sessions = sessionsRaw.map((session) => ({
    ...session,
    attendance: session.attendance ?? null,
  }));

  const attendanceCounts = sessions.reduce(
    (acc, session) => {
      const status = session.attendance?.status;
      if (status === 'present') acc.present += 1;
      if (status === 'absent') acc.absent += 1;
      if (status === 'late') acc.late += 1;
      if (status === 'excused') acc.excused += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 }
  );

  const submissions = submissionsRaw.map((row) => ({
    ...repo.mapSubmissionRow(row, { exposeAiAudit: true }),
    task_title: row.field_training_tasks?.title ?? null,
    due_date: row.field_training_tasks?.due_date ?? null,
    is_final_task: row.field_training_tasks?.is_final_task ?? false,
    requires_ai_self_evaluation: row.field_training_tasks?.requires_ai_self_evaluation ?? false,
    has_instruction_file: Boolean(row.field_training_tasks?.instruction_file_path),
    instruction_file_name: row.field_training_tasks?.instruction_file_name ?? null,
    solution_file_name: row.file_name ?? null,
    has_solution_file: Boolean(row.file_path),
  }));

  const eligibility = await ftEligibility.findActiveByOpportunityId(app.opportunity_id);
  const eligibilityMatch = eligibility.find(
    (row) =>
      row.university_id === profile?.primary_university_id &&
      row.university_specialty_id === profile?.university_specialty_id
  );

  let instructor = null;
  if (opp.assigned_instructor_id) {
    const [ins] = await repo.findUsersByIds([opp.assigned_instructor_id]);
    instructor = ins ? { id: ins.id, full_name: ins.full_name, email: ins.email } : null;
  }

  const hoursProgress = await hoursMod.calculateHoursProgressForApplication(
    app.id,
    opp.required_training_hours
  );

  const progress = progressBuilder.buildParticipantProgress(app, opp, {
    sessionsCount: sessions.length,
    tasksCount: tasks.length,
    tasksSubmitted: submissions.length,
    hoursProgress,
  });

  return {
    report_title: 'تقرير الطالب التفصيلي للتدريب الميداني',
    student: {
      id: profile?.id ?? app.student_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      university: profile?.university ?? null,
      university_specialty: profile?.university_specialty ?? null,
      university_specialty_label: repo.formatSpecialtyLabel(profile?.university_specialty),
      canonical_specialty: profile?.canonical_specialty ?? null,
      canonical_specialty_label: repo.formatSpecialtyLabel(profile?.canonical_specialty),
      account_status: profile?.status ?? null,
    },
    opportunity: {
      ...repo.mapOpportunityRow(opp),
      training_track: repo.mapSpecialtySummary(opp.specialties) ?? null,
      assigned_instructor: instructor,
      eligibility_used: eligibilityMatch ?? null,
      eligibility_grouped: ftEligibility.groupEligibilityByUniversity(eligibility),
    },
    application: repo.mapApplicationRow(app),
    training_hours: hoursProgress,
    pre_assessment: attemptByType.pre
      ? {
          score: attemptByType.pre.score != null ? Number(attemptByType.pre.score) : app.pre_assessment_score,
          level: attemptByType.pre.level ?? app.pre_assessment_level,
          submitted_at: attemptByType.pre.submitted_at,
          answers: attemptByType.pre.answers ?? null,
          assessment: attemptByType.pre.field_training_assessments ?? null,
        }
      : {
          score: app.pre_assessment_score != null ? Number(app.pre_assessment_score) : null,
          level: app.pre_assessment_level,
          submitted_at: null,
          answers: null,
          assessment: assessments.find((row) => row.type === 'pre') ?? null,
        },
    post_assessment: attemptByType.post
      ? {
          score: attemptByType.post.score != null ? Number(attemptByType.post.score) : app.post_assessment_score,
          level: attemptByType.post.level,
          submitted_at: attemptByType.post.submitted_at,
          passed:
            attemptByType.post.score != null && attemptByType.post.field_training_assessments?.passing_score != null
              ? Number(attemptByType.post.score) >= Number(attemptByType.post.field_training_assessments.passing_score)
              : null,
          answers: attemptByType.post.answers ?? null,
          assessment: attemptByType.post.field_training_assessments ?? null,
        }
      : {
          score: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
          level: null,
          submitted_at: null,
          passed: null,
          answers: null,
          assessment: assessments.find((row) => row.type === 'post') ?? null,
        },
    sessions,
    attendance_summary: {
      total_sessions: sessions.length,
      ...attendanceCounts,
      attendance_percentage: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      attendance_eligibility:
        opp.minimum_attendance_percentage != null
          ? Number(app.attendance_percentage ?? 0) >= Number(opp.minimum_attendance_percentage)
          : null,
    },
    tasks,
    submissions,
    completion_eligibility: {
      status: app.completion_eligibility_status,
      reason: app.eligibility_reason,
      attendance_rule:
        opp.minimum_attendance_percentage != null
          ? Number(app.attendance_percentage ?? 0) >= Number(opp.minimum_attendance_percentage)
          : null,
      hours_rule:
        opp.required_training_hours != null
          ? hoursProgress.hours_completion_status === hoursMod.HOURS_STATUS.COMPLETED
          : null,
      task_rule: opp.requires_final_task ? app.final_task_status === 'approved' : true,
      post_assessment_rule:
        opp.requires_post_assessment && opp.minimum_post_assessment_score != null
          ? Number(app.post_assessment_score ?? 0) >= Number(opp.minimum_post_assessment_score)
          : null,
    },
    completion_letter: letter
      ? {
          issued: true,
          letter_no: letter.letter_no,
          issued_at: letter.issued_at,
          verification_code: letter.verification_code ?? null,
          pdf_url: letter.pdf_url ?? null,
          status: letter.status,
        }
      : { issued: false },
    progress,
    timeline: buildTimeline(app, opp, sessions, submissions, letter, attemptByType),
  };
}

function summarizeOpportunityUniversityApps(apps) {
  const approved = apps.filter((app) => app.status === 'approved');
  return {
    applicants_count: apps.length,
    pending_count: apps.filter((app) => app.status === 'pending').length,
    accepted_count: approved.length,
    in_training_count: approved.filter((app) => IN_TRAINING_STATUSES.has(app.training_status)).length,
    completed_count: approved.filter((app) => app.training_status === 'completed').length,
    expelled_count: approved.filter((app) => app.training_status === 'expelled').length,
    average_attendance: average(approved.map((app) => app.attendance_percentage)),
  };
}

async function listUniversityEligibleOpportunities(universityId, filters = {}) {
  const opportunities = await prisma.field_training_opportunities.findMany({
    where: {
      ...(filters.opportunity_id ? { id: filters.opportunity_id } : {}),
      field_training_opportunity_eligibility: {
        some: {
          university_id: universityId,
          is_active: true,
          ...(filters.university_specialty_id
            ? { university_specialty_id: filters.university_specialty_id }
            : {}),
        },
      },
    },
    include: {
      specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
      field_training_opportunity_eligibility: {
        where: { university_id: universityId, is_active: true },
        include: {
          university_specialties: {
            select: { id: true, name_ar: true, name_en: true, code: true },
          },
        },
      },
    },
    orderBy: [{ start_date: 'desc' }, { created_at: 'desc' }],
  });

  if (!opportunities.length) return [];

  const studentIds = await studentIdsForUniversity(universityId);
  const opportunityIds = opportunities.map((opp) => opp.id);
  const apps = studentIds.length
    ? await prisma.field_training_applications.findMany({
        where: {
          opportunity_id: { in: opportunityIds },
          student_id: { in: studentIds },
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.training_status ? { training_status: filters.training_status } : {}),
        },
        select: {
          id: true,
          opportunity_id: true,
          status: true,
          training_status: true,
          attendance_percentage: true,
        },
      })
    : [];

  const appsByOpp = new Map();
  for (const id of opportunityIds) appsByOpp.set(id, []);
  for (const app of apps) {
    const list = appsByOpp.get(app.opportunity_id);
    if (list) list.push(app);
  }

  const instructorIds = [
    ...new Set(opportunities.map((opp) => opp.assigned_instructor_id).filter(Boolean)),
  ];
  const instructors = instructorIds.length ? await repo.findUsersByIds(instructorIds) : [];
  const instructorById = Object.fromEntries(instructors.map((row) => [row.id, row]));

  return opportunities.map((opp) => {
    const stats = summarizeOpportunityUniversityApps(appsByOpp.get(opp.id) || []);
    const instructor = opp.assigned_instructor_id
      ? instructorById[opp.assigned_instructor_id] ?? null
      : null;
    return {
      id: opp.id,
      title: opp.title,
      status: opp.status,
      training_mode: opp.training_mode,
      location: opp.location,
      start_date: opp.start_date,
      end_date: opp.end_date,
      required_training_hours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
      training_track: repo.mapSpecialtySummary(opp.specialties) ?? null,
      assigned_instructor: instructor
        ? { id: instructor.id, full_name: instructor.full_name, email: instructor.email }
        : null,
      eligible_specialties: (opp.field_training_opportunity_eligibility || []).map((row) => ({
        id: row.university_specialty_id,
        label: repo.formatSpecialtyLabel(row.university_specialties),
        university_specialty: row.university_specialties,
        seats_limit: row.seats_limit,
      })),
      ...stats,
    };
  });
}

async function getUniversityOpportunityDetail(universityId, opportunityId) {
  const opportunity = await prisma.field_training_opportunities.findFirst({
    where: {
      id: opportunityId,
      field_training_opportunity_eligibility: {
        some: { university_id: universityId, is_active: true },
      },
    },
    include: {
      specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
      field_training_opportunity_eligibility: {
        where: { university_id: universityId, is_active: true },
        include: {
          university_specialties: {
            select: { id: true, name_ar: true, name_en: true, code: true },
          },
        },
      },
    },
  });
  if (!opportunity) return null;

  const report = await buildUniversityReport(universityId, { opportunity_id: opportunityId });
  const [listed] = await listUniversityEligibleOpportunities(universityId, {
    opportunity_id: opportunityId,
  });

  return {
    university: report?.university ?? (await loadUniversity(universityId)),
    opportunity: listed ?? null,
    summary: report?.summary ?? emptyUniversitySummary(),
    students: report?.students ?? [],
  };
}

module.exports = {
  buildUniversityDashboard,
  buildUniversityReport,
  buildStudentDetailedReport,
  listUniversityEligibleOpportunities,
  getUniversityOpportunityDetail,
  loadUniversity,
};
