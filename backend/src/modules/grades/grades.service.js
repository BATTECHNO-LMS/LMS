const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { normalizeRoles, assessmentCohortScopeWhere } = require('../../utils/deliveryAccess');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const assessmentsRepo = require('../assessments/assessments.repository');
const assessmentsService = require('../assessments/assessments.service');
const repo = require('./grades.repository');

const STAFF_ROLES = new Set([
  'super_admin',
  'program_admin',
  'university_admin',
  'academic_admin',
  'qa_officer',
  'instructor',
]);

function isStaff(requester) {
  if (requester.isGlobal) return true;
  return normalizeRoles(requester.roles).some((r) => STAFF_ROLES.has(r));
}

async function loadGradersMap(graderIds) {
  const uniq = [...new Set(graderIds.filter(Boolean))];
  if (!uniq.length) return new Map();
  const users = await prisma.users.findMany({
    where: { id: { in: uniq } },
    select: { id: true, full_name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

async function loadStudentsMap(studentIds) {
  const uniq = [...new Set(studentIds)];
  if (!uniq.length) return new Map();
  const users = await prisma.users.findMany({
    where: { id: { in: uniq } },
    select: { id: true, full_name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

function mapGrade(row, studentMap, graderMap) {
  const a = row.assessments;
  const cohort = a?.cohorts;
  const st = studentMap?.get(row.student_id);
  const gr = row.grader_id ? graderMap?.get(row.grader_id) : null;
  return {
    id: row.id,
    assessment_id: row.assessment_id,
    student_id: row.student_id,
    student: st ? { id: st.id, full_name: st.full_name, email: st.email } : { id: row.student_id },
    grader_id: row.grader_id,
    grader: gr ? { id: gr.id, full_name: gr.full_name } : null,
    score: row.score != null ? Number(row.score) : null,
    feedback: row.feedback,
    graded_at: row.graded_at,
    is_final: row.is_final,
    assessment: a
      ? {
          id: a.id,
          title: a.title,
          cohort: cohort ? { id: cohort.id, title: cohort.title } : null,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listGrades(query, requester) {
  const where = {};
  if (query.assessment_id) where.assessment_id = query.assessment_id;
  if (query.student_id) where.student_id = query.student_id;
  if (query.is_final !== undefined) where.is_final = query.is_final;

  if (isStaff(requester)) {
    const assessmentWhere = {};
    if (query.cohort_id) assessmentWhere.cohort_id = query.cohort_id;
    const scope = assessmentCohortScopeWhere(requester);
    if (Object.keys(scope).length) Object.assign(assessmentWhere, scope);
    if (Object.keys(assessmentWhere).length) where.assessments = assessmentWhere;
  } else if (normalizeRoles(requester.roles).includes('student')) {
    where.student_id = requester.userId;
  } else {
    throw new ApiError(403, 'Forbidden');
  }

  const rows = await repo.findMany(where, { take: 300 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  const gm = await loadGradersMap(rows.map((r) => r.grader_id));
  return { grades: rows.map((r) => mapGrade(r, sm, gm)) };
}

async function getGradeById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Grade not found');
  const assessment = await assessmentsRepo.findById(row.assessment_id);
  await assessmentsService.assertCanReadAssessment(requester, assessment);
  if (!isStaff(requester) && row.student_id !== requester.userId) throw new ApiError(403, 'Forbidden');
  const sm = await loadStudentsMap([row.student_id]);
  const gm = await loadGradersMap([row.grader_id]);
  return mapGrade(row, sm, gm);
}

async function listByAssessment(assessmentId, requester) {
  const assessment = await assessmentsRepo.findById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  await assessmentsService.assertCanReadAssessment(requester, assessment);
  const rows = await repo.findMany({ assessment_id: assessmentId }, { take: 500 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  const gm = await loadGradersMap(rows.map((r) => r.grader_id));
  return { grades: rows.map((r) => mapGrade(r, sm, gm)) };
}

async function listByStudent(studentId, requester) {
  if (!isStaff(requester) && studentId !== requester.userId) throw new ApiError(403, 'Forbidden');
  const rows = await repo.findMany({ student_id: studentId }, { take: 500 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  const gm = await loadGradersMap(rows.map((r) => r.grader_id));
  return { grades: rows.map((r) => mapGrade(r, sm, gm)) };
}

async function assertStaffGrader(requester, assessment) {
  if (!isStaff(requester)) throw new ApiError(403, 'Forbidden');
  await assessmentsService.assertCanWriteAssessment(requester, assessment);
}

async function createGradeForAssessment(assessmentId, body, requester) {
  const assessment = await assessmentsRepo.findById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  await assertStaffGrader(requester, assessment);

  const en = await enrollmentsRepo.findByCohortAndStudent(assessment.cohort_id, body.student_id);
  if (!en || !['enrolled', 'pending', 'completed'].includes(en.enrollment_status)) {
    throw new ApiError(400, 'Student is not enrolled in this assessment cohort');
  }

  const subCount = await repo.countSubmissionsForStudent(assessmentId, body.student_id);
  if (subCount < 1) {
    throw new ApiError(400, 'Cannot grade without at least one submission');
  }

  const score = Number(body.score);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    throw new ApiError(400, 'score must be between 0 and 100');
  }

  const wantFinal = Boolean(body.is_final);

  const existingFinal = await prisma.grades.findFirst({
    where: { assessment_id: assessmentId, student_id: body.student_id, is_final: true },
  });

  if (wantFinal && existingFinal) {
    const row = await repo.update(existingFinal.id, {
      score,
      feedback: body.feedback ?? null,
      grader_id: requester.userId,
      graded_at: new Date(),
      is_final: true,
    });
    const sm = await loadStudentsMap([row.student_id]);
    const gm = await loadGradersMap([row.grader_id]);
    return mapGrade(row, sm, gm);
  }

  if (wantFinal && !existingFinal) {
    await prisma.grades.deleteMany({
      where: { assessment_id: assessmentId, student_id: body.student_id, is_final: false },
    });
    const row = await repo.create({
      assessment_id: assessmentId,
      student_id: body.student_id,
      grader_id: requester.userId,
      score,
      feedback: body.feedback ?? null,
      is_final: true,
    });
    const sm = await loadStudentsMap([row.student_id]);
    const gm = await loadGradersMap([row.grader_id]);
    return mapGrade(row, sm, gm);
  }

  const draft = await prisma.grades.findFirst({
    where: { assessment_id: assessmentId, student_id: body.student_id, is_final: false },
  });
  if (draft) {
    const row = await repo.update(draft.id, {
      score,
      feedback: body.feedback ?? null,
      grader_id: requester.userId,
      graded_at: new Date(),
    });
    const sm = await loadStudentsMap([row.student_id]);
    const gm = await loadGradersMap([row.grader_id]);
    return mapGrade(row, sm, gm);
  }

  if (existingFinal) {
    throw new ApiError(400, 'A final grade already exists; update it or use finalize');
  }

  const row = await repo.create({
    assessment_id: assessmentId,
    student_id: body.student_id,
    grader_id: requester.userId,
    score,
    feedback: body.feedback ?? null,
    is_final: false,
  });
  const sm = await loadStudentsMap([row.student_id]);
  const gm = await loadGradersMap([row.grader_id]);
  return mapGrade(row, sm, gm);
}

async function updateGrade(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Grade not found');
  const assessment = await assessmentsRepo.findById(row.assessment_id);
  await assertStaffGrader(requester, assessment);

  const score = body.score !== undefined ? Number(body.score) : Number(row.score);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    throw new ApiError(400, 'score must be between 0 and 100');
  }

  const data = {
    score,
    feedback: body.feedback !== undefined ? body.feedback : row.feedback,
    is_final: body.is_final !== undefined ? body.is_final : row.is_final,
    grader_id: requester.userId,
    graded_at: new Date(),
  };

  if (data.is_final === true && !row.is_final) {
    await prisma.grades.deleteMany({
      where: { assessment_id: row.assessment_id, student_id: row.student_id, is_final: true },
    });
  }

  const updated = await repo.update(id, data);
  const sm = await loadStudentsMap([updated.student_id]);
  const gm = await loadGradersMap([updated.grader_id]);
  return mapGrade(updated, sm, gm);
}

async function finalizeGrade(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Grade not found');
  const assessment = await assessmentsRepo.findById(row.assessment_id);
  await assertStaffGrader(requester, assessment);

  await prisma.$transaction([
    prisma.grades.deleteMany({
      where: { assessment_id: row.assessment_id, student_id: row.student_id, is_final: true },
    }),
    prisma.grades.update({
      where: { id: row.id },
      data: { is_final: true, grader_id: requester.userId, graded_at: new Date() },
    }),
  ]);

  const updated = await repo.findById(id);
  const sm = await loadStudentsMap([updated.student_id]);
  const gm = await loadGradersMap([updated.grader_id]);
  return mapGrade(updated, sm, gm);
}

module.exports = {
  listGrades,
  getGradeById,
  listByAssessment,
  listByStudent,
  createGradeForAssessment,
  updateGrade,
  finalizeGrade,
};
