const { prisma } = require('../../config/db');
const repo = require('./fieldTraining.repository');

function parseDateFilter(filters = {}) {
  const where = {};
  if (filters.from) where.gte = new Date(filters.from);
  if (filters.to) where.lte = new Date(filters.to);
  return Object.keys(where).length ? where : null;
}

async function resolveStudentIdsForFilters(filters = {}) {
  if (!filters.university_id && !filters.university_specialty_id) return null;
  const rows = await prisma.users.findMany({
    where: {
      ...(filters.university_id ? { primary_university_id: filters.university_id } : {}),
      ...(filters.university_specialty_id ? { university_specialty_id: filters.university_specialty_id } : {}),
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function buildApplicationWhere(filters = {}) {
  const createdAt = parseDateFilter(filters);
  const where = {};
  if (createdAt) where.created_at = createdAt;
  if (filters.opportunity_id) where.opportunity_id = filters.opportunity_id;
  if (filters.status) where.status = filters.status;
  if (filters.training_status) where.training_status = filters.training_status;

  const studentIds = await resolveStudentIdsForFilters(filters);
  if (studentIds !== null) {
    where.student_id = studentIds.length
      ? { in: studentIds }
      : { in: ['00000000-0000-0000-0000-000000000000'] };
  }
  return where;
}

function average(nums) {
  const values = nums.filter((n) => n != null && !Number.isNaN(Number(n)));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, n) => sum + Number(n), 0) / values.length) * 100) / 100;
}

async function buildGlobalReport(filters = {}) {
  const createdAt = parseDateFilter(filters);
  const appWhere = await buildApplicationWhere(filters);

  const opportunityWhere = {
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(filters.opportunity_id ? { id: filters.opportunity_id } : {}),
    ...(filters.university_id
      ? {
          field_training_opportunity_eligibility: {
            some: { university_id: filters.university_id, is_active: true },
          },
        }
      : {}),
  };

  const [universities, opportunities, eligibilityRows, applications] = await Promise.all([
    prisma.universities.findMany({
      where: { status: 'active', ...(filters.university_id ? { id: filters.university_id } : {}) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.field_training_opportunities.findMany({
      where: opportunityWhere,
      include: {
        specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
        universities: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.field_training_opportunity_eligibility.findMany({
      where: {
        is_active: true,
        ...(filters.university_id ? { university_id: filters.university_id } : {}),
        ...(filters.university_specialty_id ? { university_specialty_id: filters.university_specialty_id } : {}),
        ...(filters.opportunity_id ? { opportunity_id: filters.opportunity_id } : {}),
      },
      include: {
        universities: { select: { id: true, name: true } },
        university_specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
        specialties: { select: { id: true, name_ar: true, name_en: true, code: true } },
        field_training_opportunities: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.field_training_applications.findMany({
      where: appWhere,
      orderBy: { created_at: 'desc' },
    }),
  ]);

  const applicationIds = applications.map((app) => app.id);
  const scopedAppIds = applicationIds.length
    ? applicationIds
    : ['00000000-0000-0000-0000-000000000000'];

  const [attendanceRows, submissions, preAttempts, postAttempts, completionLetters, expelledApps] =
    await Promise.all([
    prisma.field_training_attendance.findMany({
      where: {
        ...(createdAt ? { created_at: createdAt } : {}),
        ...(filters.university_id || filters.university_specialty_id || filters.opportunity_id
          ? { application_id: { in: scopedAppIds } }
          : {}),
      },
      include: {
        field_training_sessions: { select: { id: true, title: true, session_date: true, opportunity_id: true } },
      },
    }),
    prisma.field_training_task_submissions.findMany({
      where: {
        ...(createdAt ? { submitted_at: createdAt } : {}),
        ...(filters.opportunity_id ? { field_training_tasks: { opportunity_id: filters.opportunity_id } } : {}),
        ...(filters.university_id || filters.university_specialty_id
          ? { application_id: { in: scopedAppIds } }
          : {}),
      },
      include: {
        field_training_tasks: {
          select: { id: true, title: true, opportunity_id: true, is_final_task: true, requires_ai_self_evaluation: true },
        },
      },
    }),
    prisma.field_training_assessment_attempts.findMany({
      where: {
        field_training_assessments: { type: 'pre' },
        ...(createdAt ? { submitted_at: createdAt } : {}),
        ...(filters.opportunity_id
          ? { field_training_assessments: { opportunity_id: filters.opportunity_id, type: 'pre' } }
          : {}),
      },
      include: {
        field_training_assessments: { select: { id: true, title: true, opportunity_id: true, type: true } },
      },
    }),
    prisma.field_training_assessment_attempts.findMany({
      where: {
        field_training_assessments: { type: 'post' },
        ...(createdAt ? { submitted_at: createdAt } : {}),
        ...(filters.opportunity_id
          ? { field_training_assessments: { opportunity_id: filters.opportunity_id, type: 'post' } }
          : {}),
      },
      include: {
        field_training_assessments: { select: { id: true, title: true, opportunity_id: true, type: true, passing_score: true } },
      },
    }),
    prisma.field_training_completion_letters.findMany({
      where: {
        status: 'issued',
        ...(createdAt ? { issued_at: createdAt } : {}),
        ...(filters.opportunity_id ? { opportunity_id: filters.opportunity_id } : {}),
      },
    }),
    prisma.field_training_applications.findMany({
      where: { ...appWhere, training_status: 'expelled' },
    }),
  ]);

  const studentIds = [...new Set(applications.map((app) => app.student_id))];
  const profiles = await repo.findStudentProfilesByIds(studentIds);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const oppById = Object.fromEntries(opportunities.map((o) => [o.id, o]));

  const universityComparison = universities.map((uni) => {
    const uniStudentIds = profiles.filter((p) => p.primary_university_id === uni.id).map((p) => p.id);
    const uniApps = applications.filter((app) => uniStudentIds.includes(app.student_id));
    const approved = uniApps.filter((app) => app.status === 'approved');
    const eligibleOpps = eligibilityRows.filter((row) => row.university_id === uni.id).length;
    return {
      university_id: uni.id,
      university_name: uni.name,
      eligible_opportunities: eligibleOpps,
      total_applicants: uniApps.length,
      accepted: approved.length,
      rejected: uniApps.filter((app) => app.status === 'rejected').length,
      expelled: approved.filter((app) => app.training_status === 'expelled').length,
      completed: approved.filter((app) => app.training_status === 'completed').length,
      completion_letters: approved.filter((app) => app.completion_letter_issued_at).length,
      average_attendance: average(approved.map((app) => app.attendance_percentage)),
      average_pre_assessment: average(approved.map((app) => app.pre_assessment_score)),
      average_post_assessment: average(approved.map((app) => app.post_assessment_score)),
      ai_submissions: submissions.filter((sub) => {
        const profile = profileById[sub.student_id];
        return profile?.primary_university_id === uni.id && sub.ai_prompt_used;
      }).length,
    };
  });

  const specialtyMap = new Map();
  for (const app of applications) {
    const profile = profileById[app.student_id];
    const specialtyId = profile?.university_specialty_id ?? 'unknown';
    if (!specialtyMap.has(specialtyId)) {
      specialtyMap.set(specialtyId, {
        university_specialty_id: specialtyId === 'unknown' ? null : specialtyId,
        label: repo.formatSpecialtyLabel(profile?.university_specialty),
        university_name: profile?.university?.name ?? null,
        applicants: 0,
        accepted: 0,
        attendance_values: [],
        post_values: [],
        completions: 0,
      });
    }
    const row = specialtyMap.get(specialtyId);
    row.applicants += 1;
    if (app.status === 'approved') {
      row.accepted += 1;
      if (app.attendance_percentage != null) row.attendance_values.push(Number(app.attendance_percentage));
      if (app.post_assessment_score != null) row.post_values.push(Number(app.post_assessment_score));
      if (app.training_status === 'completed' || app.completion_letter_issued_at) row.completions += 1;
    }
  }

  const specialtyComparison = [...specialtyMap.values()].map((row) => ({
    ...row,
    attendance_average: average(row.attendance_values),
    post_assessment_average: average(row.post_values),
  }));

  const summary = {
    universities_count: universities.length,
    opportunities_count: opportunities.length,
    eligibility_rows_count: eligibilityRows.length,
    applications_count: applications.length,
    students_count: studentIds.length,
    attendance_records_count: attendanceRows.length,
    task_submissions_count: submissions.length,
    pre_assessment_attempts: preAttempts.length,
    post_assessment_attempts: postAttempts.length,
    completion_letters_count: completionLetters.length,
    expelled_count: expelledApps.length,
    accepted_count: applications.filter((app) => app.status === 'approved').length,
    average_attendance: average(
      applications.filter((app) => app.status === 'approved').map((app) => app.attendance_percentage)
    ),
    average_pre_assessment: average(
      applications.filter((app) => app.status === 'approved').map((app) => app.pre_assessment_score)
    ),
    average_post_assessment: average(
      applications.filter((app) => app.status === 'approved').map((app) => app.post_assessment_score)
    ),
  };

  return {
    report_title: 'التقرير الشامل للتدريب الميداني',
    generated_at: new Date().toISOString(),
    filters,
    summary,
    university_comparison: universityComparison,
    specialty_comparison: specialtyComparison,
    universities,
    opportunities: opportunities.map((row) => repo.mapOpportunityRow(row)),
    eligibility: eligibilityRows.map((row) => ({
      id: row.id,
      opportunity_id: row.opportunity_id,
      opportunity_title: row.field_training_opportunities?.title ?? null,
      university_id: row.university_id,
      university_name: row.universities?.name ?? null,
      university_specialty_id: row.university_specialty_id,
      university_specialty_label: repo.formatSpecialtyLabel(row.university_specialties),
      canonical_specialty_label: repo.formatSpecialtyLabel(row.specialties),
      seats_limit: row.seats_limit,
      is_active: row.is_active,
    })),
    students: profiles.map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      university_name: profile.university?.name ?? null,
      university_specialty_label: repo.formatSpecialtyLabel(profile.university_specialty),
      canonical_specialty_label: repo.formatSpecialtyLabel(profile.canonical_specialty),
      account_status: profile.status,
    })),
    applications: applications.map((app) => {
      const profile = profileById[app.student_id];
      const opp = oppById[app.opportunity_id];
      return {
        ...repo.mapApplicationRow(app),
        student_name: profile?.full_name ?? null,
        student_email: profile?.email ?? null,
        university_name: profile?.university?.name ?? null,
        university_specialty_label: repo.formatSpecialtyLabel(profile?.university_specialty),
        opportunity_title: opp?.title ?? null,
      };
    }),
    attendance: attendanceRows.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      session_title: row.field_training_sessions?.title ?? null,
      session_date: row.field_training_sessions?.session_date ?? null,
      opportunity_id: row.field_training_sessions?.opportunity_id ?? null,
      application_id: row.application_id,
      student_id: row.student_id,
      status: row.status,
      note: row.note,
      recorded_at: row.recorded_at,
    })),
    submissions: submissions.map((row) => ({
      ...repo.mapSubmissionRow(row, { exposeAiAudit: true }),
      task_title: row.field_training_tasks?.title ?? null,
      opportunity_id: row.field_training_tasks?.opportunity_id ?? null,
      is_final_task: row.field_training_tasks?.is_final_task ?? false,
      requires_ai_self_evaluation: row.field_training_tasks?.requires_ai_self_evaluation ?? false,
    })),
    ai_self_evaluations: submissions
      .filter((row) => row.student_self_evaluation_input || row.ai_prompt_used || row.ai_raw_response)
      .map((row) => ({
        submission_id: row.id,
        application_id: row.application_id,
        student_id: row.student_id,
        task_title: row.field_training_tasks?.title ?? null,
        student_self_evaluation_input: row.student_self_evaluation_input,
        ai_prompt_used: row.ai_prompt_used,
        ai_model_provider: row.ai_model_provider,
        ai_model_name: row.ai_model_name,
        ai_raw_response: row.ai_raw_response,
        submitted_at: row.submitted_at,
      })),
    pre_assessments: preAttempts.map((row) => ({
      application_id: row.application_id,
      student_id: row.student_id,
      assessment_title: row.field_training_assessments?.title ?? null,
      opportunity_id: row.field_training_assessments?.opportunity_id ?? null,
      score: row.score != null ? Number(row.score) : null,
      level: row.level,
      submitted_at: row.submitted_at,
    })),
    post_assessments: postAttempts.map((row) => ({
      application_id: row.application_id,
      student_id: row.student_id,
      assessment_title: row.field_training_assessments?.title ?? null,
      opportunity_id: row.field_training_assessments?.opportunity_id ?? null,
      score: row.score != null ? Number(row.score) : null,
      level: row.level,
      passed:
        row.score != null && row.field_training_assessments?.passing_score != null
          ? Number(row.score) >= Number(row.field_training_assessments.passing_score)
          : null,
      submitted_at: row.submitted_at,
    })),
    eligibility_status: applications
      .filter((app) => app.status === 'approved')
      .map((app) => ({
        application_id: app.id,
        student_id: app.student_id,
        opportunity_id: app.opportunity_id,
        completion_eligibility_status: app.completion_eligibility_status,
        eligibility_reason: app.eligibility_reason,
        attendance_percentage: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
        final_task_status: app.final_task_status,
        post_assessment_score: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
      })),
    completion_letters: completionLetters.map((row) => ({
      id: row.id,
      application_id: row.application_id,
      student_id: row.student_id,
      opportunity_id: row.opportunity_id,
      letter_no: row.letter_no,
      issued_at: row.issued_at,
      verification_code: row.verification_code,
      pdf_url: row.pdf_url,
    })),
    expulsions: expelledApps.map((app) => ({
      application_id: app.id,
      student_id: app.student_id,
      opportunity_id: app.opportunity_id,
      expelled_at: app.expelled_at,
      expulsion_reason: app.expulsion_reason,
      student_name: profileById[app.student_id]?.full_name ?? null,
      opportunity_title: oppById[app.opportunity_id]?.title ?? null,
    })),
    raw_rows: applications.map((app) => {
      const profile = profileById[app.student_id];
      return {
        application_id: app.id,
        student_id: app.student_id,
        student_name: profile?.full_name,
        university_name: profile?.university?.name,
        university_specialty: repo.formatSpecialtyLabel(profile?.university_specialty),
        opportunity_id: app.opportunity_id,
        opportunity_title: oppById[app.opportunity_id]?.title,
        status: app.status,
        training_status: app.training_status,
        attendance_percentage: app.attendance_percentage,
        pre_assessment_score: app.pre_assessment_score,
        post_assessment_score: app.post_assessment_score,
        final_task_status: app.final_task_status,
        completion_eligibility_status: app.completion_eligibility_status,
        completion_letter_issued_at: app.completion_letter_issued_at,
        expelled_at: app.expelled_at,
        created_at: app.created_at,
      };
    }),
  };
}

module.exports = {
  buildGlobalReport,
  buildApplicationWhere,
  parseDateFilter,
  average,
};
