const { prisma } = require('../../config/db');
const { buildApplicationWhere, average } = require('./fieldTrainingGlobalReport.repository');

function inDateRange(field, filters) {
  const where = {};
  if (filters.from) where.gte = new Date(filters.from);
  if (filters.to) where.lte = new Date(filters.to);
  return Object.keys(where).length ? { [field]: where } : {};
}

async function getMetrics(filters = {}) {
  const universityId = filters.university_id || null;
  const appWhere = await buildApplicationWhere(filters);

  const opportunityWhere = {
    ...inDateRange('created_at', filters),
    ...(filters.opportunity_id ? { id: filters.opportunity_id } : {}),
    ...(universityId
      ? { field_training_opportunity_eligibility: { some: { university_id: universityId, is_active: true } } }
      : {}),
  };

  const [eligibilityByUniversity, eligibilityBySpecialty, applications] = await Promise.all([
    prisma.field_training_opportunity_eligibility.groupBy({
      by: ['university_id'],
      where: { is_active: true, ...(universityId ? { university_id: universityId } : {}) },
      _count: { _all: true },
    }),
    prisma.field_training_opportunity_eligibility.groupBy({
      by: ['university_id', 'university_specialty_id'],
      where: { is_active: true, ...(universityId ? { university_id: universityId } : {}) },
      _count: { _all: true },
    }),
    prisma.field_training_applications.findMany({
      where: appWhere,
      select: {
        id: true,
        student_id: true,
        opportunity_id: true,
        status: true,
        training_status: true,
        attendance_percentage: true,
        pre_assessment_score: true,
        post_assessment_score: true,
        completion_letter_issued_at: true,
      },
    }),
  ]);

  const applicationIds = applications.map((app) => app.id);
  const approvedCount = applications.filter((app) => app.status === 'approved').length;

  const [attendanceRows, completionLetters, expelledCount, aiSubmissions, preAgg, postAgg] = await Promise.all([
    applicationIds.length
      ? prisma.field_training_attendance.groupBy({
          by: ['status'],
          where: { application_id: { in: applicationIds }, ...inDateRange('created_at', filters) },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    applicationIds.length
      ? prisma.field_training_completion_letters.count({
          where: { status: 'issued', application_id: { in: applicationIds }, ...inDateRange('issued_at', filters) },
        })
      : Promise.resolve(0),
    prisma.field_training_applications.count({ where: { ...appWhere, training_status: 'expelled' } }),
    applicationIds.length
      ? prisma.field_training_task_submissions.count({
          where: {
            application_id: { in: applicationIds },
            OR: [{ ai_prompt_used: { not: null } }, { student_self_evaluation_input: { not: null } }],
            ...inDateRange('submitted_at', filters),
          },
        })
      : Promise.resolve(0),
    prisma.field_training_applications.aggregate({
      where: { ...appWhere, status: 'approved', pre_assessment_score: { not: null } },
      _avg: { pre_assessment_score: true },
      _count: { _all: true },
    }),
    prisma.field_training_applications.aggregate({
      where: { ...appWhere, status: 'approved', post_assessment_score: { not: null } },
      _avg: { post_assessment_score: true },
      _count: { _all: true },
    }),
  ]);

  const studentProfiles = applications.length
    ? await prisma.users.findMany({
        where: { id: { in: [...new Set(applications.map((app) => app.student_id))] } },
        select: { id: true, primary_university_id: true, university_specialty_id: true },
      })
    : [];
  const profileById = Object.fromEntries(studentProfiles.map((p) => [p.id, p]));

  const uniIds = [...new Set(eligibilityByUniversity.map((row) => row.university_id))];
  const specialtyIds = [...new Set(eligibilityBySpecialty.map((row) => row.university_specialty_id))];
  const [universities, specialties] = await Promise.all([
    uniIds.length ? prisma.universities.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } }) : [],
    specialtyIds.length
      ? prisma.university_specialties.findMany({
          where: { id: { in: specialtyIds } },
          select: { id: true, name_ar: true, name_en: true },
        })
      : [],
  ]);
  const uniName = new Map(universities.map((u) => [u.id, u.name]));
  const specialtyName = new Map(specialties.map((s) => [s.id, s.name_ar || s.name_en]));

  const applicationsByUniversity = new Map();
  const applicationsByUniversitySpecialty = new Map();
  const attendanceByUniversity = new Map();
  const completionByUniversity = new Map();
  const expelledByUniversity = new Map();

  for (const app of applications) {
    const profile = profileById[app.student_id];
    const uni = profile?.primary_university_id;
    const spec = profile?.university_specialty_id;
    if (uni) applicationsByUniversity.set(uni, (applicationsByUniversity.get(uni) || 0) + 1);
    if (spec) applicationsByUniversitySpecialty.set(spec, (applicationsByUniversitySpecialty.get(spec) || 0) + 1);
    if (!uni) continue;
    if (app.attendance_percentage != null) {
      if (!attendanceByUniversity.has(uni)) attendanceByUniversity.set(uni, []);
      attendanceByUniversity.get(uni).push(Number(app.attendance_percentage));
    }
    if (app.completion_letter_issued_at || app.training_status === 'completed') {
      completionByUniversity.set(uni, (completionByUniversity.get(uni) || 0) + 1);
    }
    if (app.training_status === 'expelled') {
      expelledByUniversity.set(uni, (expelledByUniversity.get(uni) || 0) + 1);
    }
  }

  const attended = attendanceRows.reduce((sum, row) => {
    if (['present', 'late', 'excused'].includes(row.status)) return sum + row._count._all;
    return sum;
  }, 0);
  const totalAttendance = attendanceRows.reduce((sum, row) => sum + row._count._all, 0);

  return {
    available: true,
    opportunitiesByUniversity: eligibilityByUniversity.map((row) => ({
      university_id: row.university_id,
      name: uniName.get(row.university_id) || row.university_id,
      count: row._count._all,
    })),
    opportunitiesByUniversitySpecialty: eligibilityBySpecialty.map((row) => ({
      university_id: row.university_id,
      university_name: uniName.get(row.university_id) || null,
      university_specialty_id: row.university_specialty_id,
      name: specialtyName.get(row.university_specialty_id) || row.university_specialty_id,
      count: row._count._all,
    })),
    applicationsByUniversity: [...applicationsByUniversity.entries()].map(([id, count]) => ({
      university_id: id,
      name: uniName.get(id) || id,
      count,
    })),
    applicationsByUniversitySpecialty: [...applicationsByUniversitySpecialty.entries()].map(([id, count]) => ({
      university_specialty_id: id,
      name: specialtyName.get(id) || id,
      count,
    })),
    attendanceByUniversity: [...attendanceByUniversity.entries()].map(([id, values]) => ({
      university_id: id,
      name: uniName.get(id) || id,
      average: average(values),
    })),
    completionByUniversity: [...completionByUniversity.entries()].map(([id, count]) => ({
      university_id: id,
      name: uniName.get(id) || id,
      count,
    })),
    expelledByUniversity: [...expelledByUniversity.entries()].map(([id, count]) => ({
      university_id: id,
      name: uniName.get(id) || id,
      count,
    })),
    completionLettersIssued: completionLetters,
    expelledStudents: expelledCount,
    aiTaskSubmissionRate: approvedCount > 0 ? Math.round((aiSubmissions / approvedCount) * 1000) / 10 : null,
    averagePreAssessmentScore:
      preAgg._avg.pre_assessment_score != null ? Number(preAgg._avg.pre_assessment_score) : null,
    averagePostAssessmentScore:
      postAgg._avg.post_assessment_score != null ? Number(postAgg._avg.post_assessment_score) : null,
    preAssessmentCompleted: preAgg._count._all,
    postAssessmentCompleted: postAgg._count._all,
    attendanceRate: totalAttendance > 0 ? Math.round((attended / totalAttendance) * 1000) / 10 : null,
    totalApplications: applications.length,
    approvedApplications: approvedCount,
    opportunityWhereApplied: Boolean(universityId || filters.opportunity_id),
  };
}

module.exports = { getMetrics };
