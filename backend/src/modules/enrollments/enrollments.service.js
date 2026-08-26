const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { canAccessCohort, normalizeRoles, cohortListWhere } = require('../../utils/deliveryAccess');
const { resolvePrimaryUniversityId } = require('../../utils/studentScope');
const { dateOnlyISO } = require('../../utils/dateOnly');
const { recordAudit } = require('../../utils/auditRecorder');
const notificationService = require('../../shared/services/notification.service');
const { prisma } = require('../../config/db');
const enrollmentsRepository = require('./enrollments.repository');
const cohortsRepository = require('../cohorts/cohorts.repository');

function decToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

function toEnrollmentJson(row, student) {
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    student_id: row.student_id,
    student: student || null,
    enrollment_status: row.enrollment_status,
    final_status: row.final_status,
    final_grade: decToNumber(row.final_grade),
    attendance_percentage: decToNumber(row.attendance_percentage),
    recognition_eligibility_status: row.recognition_eligibility_status,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ? row.approved_at.toISOString() : null,
    rejection_reason: row.rejection_reason ?? null,
    enrolled_at: row.enrolled_at,
    completion_date: row.completion_date,
    certificate_issued_at: row.certificate_issued_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function serializeEnrollmentRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const students = await enrollmentsRepository.findUsersBrief(list.map((r) => r.student_id));
  const byId = new Map(students.map((s) => [s.id, s]));
  return list.map((row) => toEnrollmentJson(row, byId.get(row.student_id) || null));
}

async function serializeEnrollment(row) {
  const [mapped] = await serializeEnrollmentRows([row]);
  return mapped;
}

async function attachCohortContext(rows, bases) {
  const cohortIds = [...new Set(rows.map((r) => r.cohort_id))];
  const cohorts = await cohortsRepository.findManyByIds(cohortIds);
  const byCohort = new Map(cohorts.map((c) => [c.id, c]));
  const [mcs, unis] = await Promise.all([
    cohortsRepository.findMicroCredentialsByIds(cohorts.map((c) => c.micro_credential_id)),
    cohortsRepository.findUniversitiesByIds(cohorts.map((c) => c.university_id)),
  ]);
  const mcMap = new Map(mcs.map((m) => [m.id, m]));
  const uniMap = new Map(unis.map((u) => [u.id, u]));
  return bases.map((base, i) => {
    const cohort = byCohort.get(rows[i].cohort_id);
    if (!cohort) return { ...base, cohort: null };
    const mc = mcMap.get(cohort.micro_credential_id);
    const uni = uniMap.get(cohort.university_id);
    return {
      ...base,
      cohort: {
        id: cohort.id,
        title: cohort.title,
        status: cohort.status,
        start_date: dateOnlyISO(cohort.start_date),
        end_date: dateOnlyISO(cohort.end_date),
        micro_credential: mc
          ? { id: mc.id, title: mc.title, code: mc.code, status: mc.status, description: mc.description ?? null }
          : null,
        university: uni ? { id: uni.id, name: uni.name, status: uni.status } : null,
      },
    };
  });
}

function assertEnrollmentDecisionRole(requester) {
  const roles = normalizeRoles(requester.roles);
  const allowed = env.ENROLLMENT_DECISION_ROLE_CODES;
  if (roles.some((r) => allowed.includes(r))) return;
  throw new ApiError(403, 'Forbidden');
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
  const enrollments = await serializeEnrollmentRows(rows);
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

/**
 * Student self-service enrollment request (pending until admin approves).
 * @param {{ cohort_id: string, student_id?: string }} body
 * @param {import('../../types/http').RequestUser} requester
 */
async function requestEnrollment(body, requester) {
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes(String(env.STUDENT_ROLE_CODE || 'student').toLowerCase())) {
    throw new ApiError(403, 'Forbidden');
  }
  if (body.student_id && body.student_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden');
  }

  const cohortId = body.cohort_id;
  const cohort = await cohortsRepository.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Cohort not found');

  const primaryUni = await resolvePrimaryUniversityId(requester);
  if (!primaryUni) {
    throw new ApiError(400, 'Primary university is required for your account');
  }
  if (String(cohort.university_id) !== String(primaryUni)) {
    throw new ApiError(403, 'Forbidden');
  }

  if (cohort.status !== 'open_for_enrollment') {
    throw new ApiError(400, 'Cohort is not open for enrollment');
  }

  const student = await enrollmentsRepository.findUserBrief(requester.userId);
  if (!student) throw new ApiError(404, 'Student not found');
  if (student.status !== 'active') {
    throw new ApiError(400, 'Student account must be active');
  }

  const okStudent = await enrollmentsRepository.userHasRoleCode(requester.userId, env.STUDENT_ROLE_CODE);
  if (!okStudent) {
    throw new ApiError(400, 'User does not have the student role');
  }

  const existing = await enrollmentsRepository.findByCohortAndStudent(cohortId, requester.userId);
  if (existing) {
    if (existing.enrollment_status === 'pending') {
      return serializeEnrollment(existing);
    }
    if (existing.enrollment_status === 'enrolled' || existing.enrollment_status === 'completed') {
      throw new ApiError(409, 'Student is already enrolled in this cohort');
    }
    if (!['rejected', 'cancelled', 'withdrawn'].includes(existing.enrollment_status)) {
      throw new ApiError(409, 'Enrollment already exists for this cohort');
    }
    const used = await cohortsRepository.countEnrollmentsForCapacity(cohortId);
    if (used >= cohort.capacity) {
      throw new ApiError(400, 'Cohort has reached its enrollment capacity');
    }
    const updated = await enrollmentsRepository.update(existing.id, {
      enrollment_status: 'pending',
      final_status: 'in_progress',
      recognition_eligibility_status: 'unknown',
      updated_at: new Date(),
    });
    await notificationService.notifyStakeholdersStudentEnrollmentRequested({
      universityId: cohort.university_id,
    });
    await recordAudit({
      userId: requester.userId,
      universityId: cohort.university_id,
      actionType: 'enrollment_requested',
      entityType: 'enrollment',
      entityId: updated.id,
      newValues: { cohort_id: cohortId, enrollment_status: 'pending' },
    });
    return serializeEnrollment(updated);
  }

  const used = await cohortsRepository.countEnrollmentsForCapacity(cohortId);
  if (used >= cohort.capacity) {
    throw new ApiError(400, 'Cohort has reached its enrollment capacity');
  }

  const created = await enrollmentsRepository.create({
    cohort_id: cohortId,
    student_id: requester.userId,
    enrollment_status: 'pending',
    final_status: 'in_progress',
    recognition_eligibility_status: 'unknown',
  });

  await notificationService.notifyStakeholdersStudentEnrollmentRequested({
    universityId: cohort.university_id,
  });
  await recordAudit({
    userId: requester.userId,
    universityId: cohort.university_id,
    actionType: 'enrollment_requested',
    entityType: 'enrollment',
    entityId: created.id,
    newValues: { cohort_id: cohortId, enrollment_status: 'pending' },
  });

  return serializeEnrollment(created);
}

async function listPending(requester) {
  assertEnrollmentDecisionRole(requester);
  const cw = cohortListWhere(requester);
  let pendingRows;
  if (cw === null) {
    pendingRows = await prisma.enrollments.findMany({
      where: { enrollment_status: 'pending' },
      orderBy: { enrolled_at: 'asc' },
    });
  } else {
    const cohortRows = await prisma.cohorts.findMany({
      where: cw,
      select: { id: true },
    });
    const cohortIds = cohortRows.map((c) => c.id);
    if (!cohortIds.length) return { enrollments: [] };
    pendingRows = await prisma.enrollments.findMany({
      where: { enrollment_status: 'pending', cohort_id: { in: cohortIds } },
      orderBy: { enrolled_at: 'asc' },
    });
  }
  const bases = await serializeEnrollmentRows(pendingRows);
  const enrollments = await attachCohortContext(pendingRows, bases);
  return { enrollments };
}

async function approveEnrollment(id, requester) {
  assertEnrollmentDecisionRole(requester);
  const row = await enrollmentsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Enrollment not found');
  const cohort = await cohortsRepository.findById(row.cohort_id);
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  if (row.enrollment_status !== 'pending') {
    throw new ApiError(400, 'Only pending enrollments can be approved');
  }
  const used = await cohortsRepository.countEnrollmentsForCapacity(row.cohort_id);
  if (used >= cohort.capacity) {
    throw new ApiError(400, 'Cohort has reached its enrollment capacity');
  }
  const updated = await enrollmentsRepository.update(id, {
    enrollment_status: 'enrolled',
    final_status: 'in_progress',
    approved_by: requester.userId,
    approved_at: new Date(),
    rejection_reason: null,
    updated_at: new Date(),
  });
  await notificationService.notifyStudentEnrollmentApproved(row.student_id);
  await recordAudit({
    userId: requester.userId,
    universityId: cohort.university_id,
    actionType: 'enrollment_approved',
    entityType: 'enrollment',
    entityId: id,
    oldValues: { enrollment_status: 'pending' },
    newValues: { enrollment_status: 'enrolled', approved_by: requester.userId },
  });
  return serializeEnrollment(updated);
}

async function rejectEnrollment(id, body, requester) {
  assertEnrollmentDecisionRole(requester);
  const row = await enrollmentsRepository.findById(id);
  if (!row) throw new ApiError(404, 'Enrollment not found');
  const cohort = await cohortsRepository.findById(row.cohort_id);
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  if (row.enrollment_status !== 'pending') {
    throw new ApiError(400, 'Only pending enrollments can be rejected');
  }
  const updated = await enrollmentsRepository.update(id, {
    enrollment_status: 'rejected',
    rejection_reason: body.rejection_reason != null ? String(body.rejection_reason).slice(0, 2000) : null,
    approved_by: null,
    approved_at: null,
    updated_at: new Date(),
  });
  await notificationService.notifyStudentEnrollmentRejected(row.student_id);
  await recordAudit({
    userId: requester.userId,
    universityId: cohort.university_id,
    actionType: 'enrollment_rejected',
    entityType: 'enrollment',
    entityId: id,
    oldValues: { enrollment_status: 'pending' },
    newValues: { enrollment_status: 'rejected', rejection_reason: updated.rejection_reason },
  });
  return serializeEnrollment(updated);
}

/**
 * Current student's enrollments with cohort / program context (student role only).
 * @param {import('../../types/http').RequestUser} requester
 */
async function listMine(requester) {
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes(String(env.STUDENT_ROLE_CODE || 'student').toLowerCase())) {
    throw new ApiError(403, 'Forbidden');
  }
  const rows = await enrollmentsRepository.findManyByStudent(requester.userId);
  const bases = await serializeEnrollmentRows(rows);
  const enrollments = await attachCohortContext(rows, bases);
  return { enrollments };
}

module.exports = {
  listByCohort,
  getById,
  createForCohort,
  patchStatus,
  listMine,
  requestEnrollment,
  listPending,
  approveEnrollment,
  rejectEnrollment,
};
