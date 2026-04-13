const { ApiError } = require('../../utils/apiError');
const { normalizeRoles, assessmentCohortScopeWhere } = require('../../utils/deliveryAccess');
const enrollmentsRepo = require('../enrollments/enrollments.repository');
const assessmentsRepo = require('../assessments/assessments.repository');
const assessmentsService = require('../assessments/assessments.service');
const { prisma } = require('../../config/db');
const repo = require('./submissions.repository');

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

async function loadStudentsMap(studentIds) {
  const uniq = [...new Set(studentIds)];
  if (!uniq.length) return new Map();
  const users = await prisma.users.findMany({
    where: { id: { in: uniq } },
    select: { id: true, full_name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

function mapSubmission(row, studentMap) {
  const a = row.assessments;
  const cohort = a?.cohorts;
  const st = studentMap?.get(row.student_id);
  return {
    id: row.id,
    assessment_id: row.assessment_id,
    student_id: row.student_id,
    student: st ? { id: st.id, full_name: st.full_name, email: st.email } : { id: row.student_id },
    attempt_id: row.attempt_id,
    submission_type: row.submission_type,
    file_url: row.file_url,
    repo_url: row.repo_url,
    text_response: row.text_response,
    submitted_at: row.submitted_at,
    status: row.status,
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

async function listSubmissions(query, requester) {
  const where = {};
  if (query.assessment_id) where.assessment_id = query.assessment_id;
  if (query.student_id) where.student_id = query.student_id;
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { text_response: { contains: query.search, mode: 'insensitive' } },
      { repo_url: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (isStaff(requester)) {
    if (query.assessment_id) {
      const a = await assessmentsRepo.findById(query.assessment_id);
      if (a) await assessmentsService.assertCanReadAssessment(requester, a);
    }
    const scope = assessmentCohortScopeWhere(requester);
    if (Object.keys(scope).length) {
      where.assessments = scope;
    }
  } else {
    const roles = normalizeRoles(requester.roles);
    if (roles.includes('student')) {
      where.student_id = requester.userId;
    } else {
      throw new ApiError(403, 'Forbidden');
    }
  }

  const rows = await repo.findMany(where, { take: 200 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  return { submissions: rows.map((r) => mapSubmission(r, sm)) };
}

async function getSubmissionById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Submission not found');
  const assessment = await assessmentsRepo.findById(row.assessment_id);
  if (!assessment) throw new ApiError(404, 'Submission not found');
  await assessmentsService.assertCanReadAssessment(requester, assessment);

  if (!isStaff(requester) && row.student_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden');
  }

  const sm = await loadStudentsMap([row.student_id]);
  const out = mapSubmission(row, sm);
  const g = await repo.findLatestGradeForStudentAssessment(row.assessment_id, row.student_id);
  if (g) {
    out.current_grade = {
      id: g.id,
      score: Number(g.score),
      feedback: g.feedback,
      is_final: g.is_final,
      graded_at: g.graded_at,
    };
  }
  return out;
}

async function listByAssessment(assessmentId, requester) {
  const assessment = await assessmentsRepo.findById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  await assessmentsService.assertCanReadAssessment(requester, assessment);
  const rows = await repo.findMany({ assessment_id: assessmentId }, { take: 500 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  return { submissions: rows.map((r) => mapSubmission(r, sm)) };
}

async function listByStudent(studentId, requester) {
  if (!isStaff(requester) && studentId !== requester.userId) {
    throw new ApiError(403, 'Forbidden');
  }
  const rows = await repo.findMany({ student_id: studentId }, { take: 500 });
  const sm = await loadStudentsMap(rows.map((r) => r.student_id));
  return { submissions: rows.map((r) => mapSubmission(r, sm)) };
}

async function createForAssessment(assessmentId, body, requester) {
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes('student')) throw new ApiError(403, 'Only students may create submissions here');

  const assessment = await assessmentsRepo.findById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');

  const en = await enrollmentsRepo.findByCohortAndStudent(assessment.cohort_id, requester.userId);
  if (!en || !['enrolled', 'pending', 'completed'].includes(en.enrollment_status)) {
    throw new ApiError(403, 'You are not enrolled in this cohort');
  }

  const now = new Date();
  const due = new Date(assessment.due_date);
  const late = now > due;

  const finalG = await repo.findAnyFinalGrade(assessmentId, requester.userId);
  if (finalG) throw new ApiError(400, 'Cannot submit: a final grade already exists');

  const status = late ? 'late' : 'submitted';

  const row = await repo.create({
    assessment_id: assessmentId,
    student_id: requester.userId,
    submission_type: body.submission_type,
    file_url: body.file_url || null,
    repo_url: body.repo_url || null,
    text_response: body.text_response || null,
    status,
  });
  const sm = await loadStudentsMap([row.student_id]);
  return mapSubmission(row, sm);
}

async function updateSubmission(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Submission not found');

  if (row.student_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden');
  }

  const finalG = await repo.findAnyFinalGrade(row.assessment_id, row.student_id);
  if (finalG) throw new ApiError(400, 'Cannot modify submission after final grade');

  if (row.status === 'graded') {
    throw new ApiError(400, 'Cannot modify graded submission');
  }

  const nextType = body.submission_type ?? row.submission_type;
  const data = {
    submission_type: nextType,
    file_url: body.file_url !== undefined ? body.file_url || null : row.file_url,
    repo_url: body.repo_url !== undefined ? body.repo_url || null : row.repo_url,
    text_response: body.text_response !== undefined ? body.text_response || null : row.text_response,
    status: 'resubmitted',
    updated_at: new Date(),
  };

  const updated = await repo.update(id, data);
  const sm = await loadStudentsMap([updated.student_id]);
  return mapSubmission(updated, sm);
}

module.exports = {
  listSubmissions,
  getSubmissionById,
  listByAssessment,
  listByStudent,
  createForAssessment,
  updateSubmission,
};
