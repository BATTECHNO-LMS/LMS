const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const enrollmentsRepository = require('./enrollments.repository');
const cohortsRepository = require('../cohorts/cohorts.repository');

function decToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

async function serializeEnrollment(row) {
  const student = await enrollmentsRepository.findUserBrief(row.student_id);
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    student_id: row.student_id,
    student,
    enrollment_status: row.enrollment_status,
    final_status: row.final_status,
    final_grade: decToNumber(row.final_grade),
    attendance_percentage: decToNumber(row.attendance_percentage),
    recognition_eligibility_status: row.recognition_eligibility_status,
    enrolled_at: row.enrolled_at,
    completion_date: row.completion_date,
    certificate_issued_at: row.certificate_issued_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function assertCohortWritable(cohortId, requester) {
  const cohort = await cohortsRepository.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  return cohort;
}

async function listByCohort(cohortId, requester) {
  await assertCohortWritable(cohortId, requester);
  const rows = await enrollmentsRepository.findManyByCohort(cohortId);
  const enrollments = await Promise.all(rows.map((r) => serializeEnrollment(r)));
  return { enrollments };
}

async function getById(id, requester) {
  const row = await enrollmentsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Enrollment not found');
  await assertCohortWritable(row.cohort_id, requester);
  return serializeEnrollment(row);
}

async function createForCohort(cohortId, body, requester) {
  const cohort = await assertCohortWritable(cohortId, requester);

  const student = await enrollmentsRepository.findUserBrief(body.student_id);
  if (!student) throw new ApiError(404, 'Student not found');
  if (student.status !== 'active') {
    throw new ApiError(400, 'Student account must be active');
  }

  const okStudent = await enrollmentsRepository.userHasRoleCode(body.student_id, env.STUDENT_ROLE_CODE);
  if (!okStudent) {
    throw new ApiError(400, 'User does not have the student role');
  }

  const existing = await enrollmentsRepository.findByCohortAndStudent(cohortId, body.student_id);
  if (existing) {
    throw new ApiError(409, 'Student is already enrolled in this cohort');
  }

  const used = await cohortsRepository.countEnrollmentsForCapacity(cohortId);
  if (used >= cohort.capacity) {
    throw new ApiError(400, 'Cohort has reached its enrollment capacity');
  }

  const created = await enrollmentsRepository.create({
    cohort_id: cohortId,
    student_id: body.student_id,
    enrollment_status: 'enrolled',
    final_status: 'in_progress',
    recognition_eligibility_status: 'unknown',
  });

  return serializeEnrollment(created);
}

async function patchStatus(id, body, requester) {
  const row = await enrollmentsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Enrollment not found');
  await assertCohortWritable(row.cohort_id, requester);

  const data = { updated_at: new Date() };
  if (body.enrollment_status !== undefined) data.enrollment_status = body.enrollment_status;
  if (body.final_status !== undefined) data.final_status = body.final_status;
  if (body.recognition_eligibility_status !== undefined) {
    data.recognition_eligibility_status = body.recognition_eligibility_status;
  }

  const updated = await enrollmentsRepository.update(id, data);
  return serializeEnrollment(updated);
}

module.exports = {
  listByCohort,
  getById,
  createForCohort,
  patchStatus,
};
