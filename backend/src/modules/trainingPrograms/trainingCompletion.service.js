'use strict';

/**
 * Institutional TRAINING_COURSE final completion + finalization workflow.
 * Builds on trainingPrograms.service's requirement snapshot (attendance, hours,
 * tasks, pre/post test, final task, evaluation) and layers batch finalization,
 * individual/course report generation, and reopen support on top of it.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { recordAudit } = require('../../shared/services/audit.service');
const { emitDomainEvent } = require('../notificationEngine');
const { buildIndividualTrainingReportData } = require('./trainingReportBuilders.service');
const officialReports = require('./trainingReports.service');
const { REPORT_TYPES } = require('./trainingReportMetrics.service');

const FINALIZATION_MODES = Object.freeze(['ELIGIBLE_ONLY', 'EXCEPTIONAL']);

/** Thresholds that drive the rules-based course report recommendations (no LLM). */
const REPORT_THRESHOLDS = Object.freeze({
  LOW_ATTENDANCE_PCT: 75,
  LOW_NPS_INDEX: 0,
  LOW_TRAINER_SCORE: 3.5,
  LOW_CONTENT_SCORE: 3.5,
  HIGH_DROPOUT_PCT: 20,
});

function isTrainerOnly(requester) {
  return (
    Boolean(requester?.roles?.includes('trainer')) &&
    !requester?.roles?.includes('admin') &&
    !isSystemWideAdmin(requester)
  );
}

async function assertTrainerProgramAccess(requester, programId, permissionKey = null) {
  if (!isTrainerOnly(requester)) return null;
  const { assertTrainerCanAccessProgram } = require('./trainerAssignments.service');
  return assertTrainerCanAccessProgram(requester, programId, permissionKey);
}

function assertManagerAccess(requester, { allowReviewer = true } = {}) {
  if (isSystemWideAdmin(requester)) return;
  if (requester.roles?.includes('admin')) return;
  if (requester.roles?.includes('trainer')) return;
  if (allowReviewer && requester.roles?.includes('reviewer')) return;
  throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
}

/**
 * Pure lifecycle-status derivation, split out so it can be unit-tested without
 * a database: given an enrollment status and a requirements snapshot (as
 * produced by trainingPrograms.computeAndPersistProgress), returns the
 * eligibility verdict and a human/UI-facing lifecycle status.
 *
 * lifecycleStatus values: COMPLETED | READY_TO_COMPLETE | FINAL_EVALUATION_SUBMITTED
 * | FINAL_EVALUATION_REQUIRED | POST_TEST_PENDING | ACTIVE
 *
 * @param {string} enrollmentStatus training_enrollment_status value
 * @param {Record<string, { required?: boolean, ok?: boolean, status?: string, pendingManual?: boolean }>} requirements
 */
function deriveCompletionEligibility(enrollmentStatus, requirements) {
  const reqs = requirements || {};
  const completedRequirements = [];
  const missingRequirements = [];
  const warnings = [];

  for (const [code, req] of Object.entries(reqs)) {
    if (!req || req.required === false) continue;
    if (req.ok) completedRequirements.push(code);
    else missingRequirements.push(code);
  }

  if (reqs.postTest?.pendingManual) warnings.push('POST_TEST_GRADING_PENDING');
  if (reqs.evaluation?.required && reqs.evaluation.status === 'LOCKED') {
    warnings.push('FINAL_EVALUATION_LOCKED');
  }

  let lifecycleStatus;
  const evaluation = reqs.evaluation;
  if (enrollmentStatus === 'COMPLETED') {
    lifecycleStatus = 'COMPLETED';
  } else if (missingRequirements.length === 0) {
    lifecycleStatus = 'READY_TO_COMPLETE';
  } else if (evaluation?.required && evaluation.ok) {
    // Evaluation is done but something else is still missing.
    lifecycleStatus = 'FINAL_EVALUATION_SUBMITTED';
  } else if (evaluation?.required && evaluation.status && evaluation.status !== 'LOCKED') {
    lifecycleStatus = 'FINAL_EVALUATION_REQUIRED';
  } else if (reqs.postTest?.required && (reqs.postTest.pendingManual || !reqs.postTest.ok)) {
    lifecycleStatus = 'POST_TEST_PENDING';
  } else {
    lifecycleStatus = 'ACTIVE';
  }

  const eligible = missingRequirements.length === 0 && enrollmentStatus !== 'WITHDRAWN';

  return {
    eligible,
    status: eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
    completedRequirements,
    missingRequirements,
    warnings,
    lifecycleStatus,
  };
}

/**
 * Loads the persisted requirement snapshot (recomputed fresh) and derives a
 * human/UI-facing lifecycle status for one enrollment. Does not require a
 * requester — this is an internal/system computation used by readiness &
 * finalization flows, which perform their own authorization separately.
 */
async function calculateTrainingCompletionEligibility(enrollmentId) {
  const { computeAndPersistProgress } = require('./trainingPrograms.service');
  const progress = await computeAndPersistProgress(enrollmentId);
  const enrollment = await prisma.training_enrollments.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');

  const requirements = progress.requirements || {};
  const derived = deriveCompletionEligibility(enrollment.status, requirements);

  return {
    enrollmentId,
    ...derived,
    requirements,
    completionPct: progress.completionPct,
  };
}

/**
 * Program-level readiness board for admins/trainers: per-trainee eligibility
 * plus aggregate counts, optionally scoped to one cohort.
 */
async function getProgramCompletionReadiness(requester, programId, { cohortId } = {}) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  assertOrganizationAccess(requester, program.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId, 'can_view_progress');
  } else {
    assertManagerAccess(requester);
  }

  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) },
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED', 'NOT_COMPLETED'] },
    },
    include: { training_cohorts: true },
    orderBy: { created_at: 'asc' },
  });

  const userIds = [...new Set(enrollments.map((e) => e.user_id))];
  const users = userIds.length
    ? await prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } })
    : [];
  const byUser = new Map(users.map((u) => [u.id, u]));

  const counts = { total: enrollments.length, completed: 0, eligible: 0, notCompleted: 0, pending: 0 };
  const trainees = [];
  for (const enrollment of enrollments) {
    const eligibility = await calculateTrainingCompletionEligibility(enrollment.id);
    if (enrollment.status === 'COMPLETED') counts.completed += 1;
    else if (enrollment.status === 'NOT_COMPLETED') counts.notCompleted += 1;
    else if (eligibility.eligible) counts.eligible += 1;
    else counts.pending += 1;

    const user = byUser.get(enrollment.user_id);
    trainees.push({
      enrollmentId: enrollment.id,
      userId: enrollment.user_id,
      fullName: user?.full_name || '—',
      email: user?.email || null,
      cohortId: enrollment.cohort_id,
      cohortName: enrollment.training_cohorts?.name || null,
      enrollmentStatus: enrollment.status,
      ...eligibility,
    });
  }

  return { programId, cohortId: cohortId || null, counts, trainees };
}

/**
 * Marks one enrollment COMPLETED, persists an individual report snapshot, and
 * issues a certificate when the course has certificates enabled. Idempotent
 * certificate issuance is handled by trainingPrograms.issueCertificateCore.
 */
function shouldIssueCertificateOnFinalize(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  return s.certificateEnabled !== false;
}

async function completeEnrollmentAndReport(requester, enrollmentId, { mode, reason } = {}) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  const program = enrollment.training_cohorts.training_programs;

  await prisma.training_enrollments.update({
    where: { id: enrollmentId },
    data: {
      status: 'COMPLETED',
      completed_at: new Date(),
      status_reason: mode === 'EXCEPTIONAL' ? reason || null : enrollment.status_reason,
      updated_at: new Date(),
    },
  });
  await prisma.training_progress.upsert({
    where: { enrollment_id: enrollmentId },
    create: {
      enrollment_id: enrollmentId,
      status: 'COMPLETED',
      completion_pct: 100,
      approved_by: requester.userId,
      approved_at: new Date(),
    },
    update: {
      status: 'COMPLETED',
      completion_pct: 100,
      approved_by: requester.userId,
      approved_at: new Date(),
      updated_at: new Date(),
    },
  });

  let reportId = null;
  const official = await officialReports.generateOfficialReport(requester, {
    reportType: REPORT_TYPES.INDIVIDUAL,
    enrollmentId,
  });
  reportId = official.id;

  const settings = program.settings_json && typeof program.settings_json === 'object' ? program.settings_json : {};
  let certificate = null;
  if (shouldIssueCertificateOnFinalize(settings)) {
    const { issueCertificateCore } = require('./trainingPrograms.service');
    certificate = await issueCertificateCore(enrollmentId, requester.userId).catch(() => null);
  }

  await emitDomainEvent('COURSE_COMPLETED', {
    organizationId: enrollment.organization_id,
    affectedUserId: enrollment.user_id,
    entityType: 'training_enrollment',
    entityId: enrollmentId,
  }).catch(() => null);
  await emitDomainEvent('INDIVIDUAL_REPORT_GENERATED', {
    organizationId: enrollment.organization_id,
    affectedUserId: enrollment.user_id,
    entityType: 'training_individual_report',
    entityId: reportId,
  }).catch(() => null);

  return { enrollmentId, reportId, certificate };
}

/**
 * Batch finalization for a program (optionally scoped to a cohort or explicit
 * enrollment id list). ELIGIBLE_ONLY completes trainees who meet every
 * requirement; EXCEPTIONAL (admin/super_admin + reason only) also completes
 * trainees who don't, recording the exception reason on the enrollment.
 */
async function finalizeTraining(requester, { programId, cohortId, enrollmentIds, mode = 'ELIGIBLE_ONLY', reason } = {}) {
  if (requester.roles?.includes('reviewer') && !isSystemWideAdmin(requester)) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only', null, 'ROLE_NOT_ALLOWED');
  }
  if (!FINALIZATION_MODES.includes(mode)) {
    throw new ApiError(400, 'وضع الإنهاء غير صالح', null, 'FINALIZATION_MODE_INVALID');
  }
  const isExceptional = mode === 'EXCEPTIONAL';
  if (isExceptional && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'الإنهاء الاستثنائي متاح لمسؤولي المؤسسة فقط.', null, 'ROLE_NOT_ALLOWED');
  }
  const trimmedReason = String(reason || '').trim();
  if (isExceptional && !trimmedReason) {
    throw new ApiError(400, 'يجب إدخال سبب للإنهاء الاستثنائي.', null, 'FINALIZATION_REASON_REQUIRED');
  }

  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  assertOrganizationAccess(requester, program.organization_id);

  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId, 'can_finalize_training');
  } else if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }

  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) },
      ...(Array.isArray(enrollmentIds) && enrollmentIds.length ? { id: { in: enrollmentIds } } : {}),
      status: { notIn: ['WITHDRAWN', 'REJECTED', 'PENDING', 'INVITED', 'NEEDS_UPDATE'] },
    },
  });
  if (!enrollments.length) {
    throw new ApiError(400, 'لا يوجد متدربون مؤهلون للإنهاء وفق المعايير المحددة.', null, 'NO_ELIGIBLE_ENROLLMENTS');
  }

  if (isTrainerOnly(requester)) {
    const { listTrainerAssignmentsForProgram, resolveAccessibleCohortIds } = require('./trainerScope');
    const rows = await listTrainerAssignmentsForProgram(requester.userId, programId);
    const accessible = resolveAccessibleCohortIds(rows);
    if (Array.isArray(accessible)) {
      const accessibleSet = new Set(accessible);
      if (enrollments.some((e) => !accessibleSet.has(e.cohort_id))) {
        throw new ApiError(
          403,
          'لا تملك صلاحية إنهاء متدربين خارج نطاق الدفعات المسندة إليك.',
          null,
          'TRAINER_ASSIGNMENT_REQUIRED'
        );
      }
    }
  }

  const eligibleCompleted = [];
  const exceptionalCompleted = [];
  const skipped = [];

  for (const enrollment of enrollments) {
    if (enrollment.status === 'COMPLETED') {
      skipped.push({ enrollmentId: enrollment.id, reason: 'ALREADY_COMPLETED' });
      continue;
    }
    const eligibility = await calculateTrainingCompletionEligibility(enrollment.id);
    if (eligibility.eligible) {
      await completeEnrollmentAndReport(requester, enrollment.id, { mode: 'ELIGIBLE_ONLY' });
      eligibleCompleted.push(enrollment.id);
    } else if (isExceptional) {
      await completeEnrollmentAndReport(requester, enrollment.id, { mode: 'EXCEPTIONAL', reason: trimmedReason });
      exceptionalCompleted.push(enrollment.id);
    } else {
      skipped.push({ enrollmentId: enrollment.id, reason: 'NOT_ELIGIBLE', missing: eligibility.missingRequirements });
      await emitDomainEvent('TRAINING_NOT_ELIGIBLE', {
        organizationId: enrollment.organization_id,
        affectedUserId: enrollment.user_id,
        entityType: 'training_enrollment',
        entityId: enrollment.id,
        templateVars: { course_title: program.title },
      }).catch(() => null);
    }
  }

  const completedIds = [...eligibleCompleted, ...exceptionalCompleted];
  let courseReport = null;
  if (completedIds.length) {
    courseReport = await generateCourseReport(requester, programId, { cohortId, mode, reason: trimmedReason || null });
  }

  await prisma.training_finalization_events.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      cohort_id: cohortId || null,
      mode,
      reason: trimmedReason || null,
      acted_by: requester.userId,
      eligible_count: eligibleCompleted.length,
      completed_count: completedIds.length,
      exceptional_count: exceptionalCompleted.length,
      enrollment_ids_json: {
        eligible: eligibleCompleted,
        exceptional: exceptionalCompleted,
        skipped: skipped.map((s) => s.enrollmentId),
      },
      result_json: { skipped },
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'TRAINING_FINALIZED',
    entityType: 'training_program',
    entityId: programId,
    newValues: { mode, completedCount: completedIds.length, exceptionalCount: exceptionalCompleted.length },
  });

  return {
    programId,
    mode,
    eligibleCompleted,
    exceptionalCompleted,
    skipped,
    courseReportId: courseReport?.id || null,
  };
}

/** Rules-based Arabic summary + structured snapshot for one trainee's final report (no LLM). */
async function buildIndividualReportSnapshot(enrollmentId) {
  return buildIndividualTrainingReportData(enrollmentId);
}

function mapIndividualReportOut(report) {
  return {
    id: report.id,
    enrollmentId: report.enrollment_id,
    programId: report.program_id,
    version: report.version,
    status: report.status,
    snapshot: report.snapshot_json,
    summary: report.summary_text,
    generatedAt: report.generated_at,
  };
}

async function assertEnrollmentReportAccess(requester, enrollment) {
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (isOwner) return;
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, enrollment.training_cohorts.training_programs.id, 'can_view_reports');
    return;
  }
  assertManagerAccess(requester);
}

async function generateIndividualReport(requester, enrollmentId) {
  const official = await officialReports.generateOfficialReport(requester, {
    reportType: REPORT_TYPES.INDIVIDUAL,
    enrollmentId,
  });
  return {
    id: official.id,
    enrollmentId: official.enrollmentId,
    programId: official.programId,
    version: official.version,
    status: official.status,
    snapshot: official.snapshot,
    summary: official.summary,
    generatedAt: official.generatedAt,
    referenceCode: official.referenceCode,
    verificationCode: official.verificationCode,
  };
}

async function getIndividualReport(requester, enrollmentId) {
  try {
    const official = await officialReports.getLatestReport(requester, {
      reportType: REPORT_TYPES.INDIVIDUAL,
      programId: (
        await prisma.training_enrollments.findUnique({
          where: { id: enrollmentId },
          include: { training_cohorts: true },
        })
      )?.training_cohorts?.program_id,
      enrollmentId,
    });
    return {
      id: official.id,
      enrollmentId: official.enrollmentId || enrollmentId,
      programId: official.programId,
      version: official.version,
      status: official.status,
      snapshot: official.snapshot,
      summary: official.summary,
      generatedAt: official.generatedAt,
      referenceCode: official.referenceCode,
      verificationCode: official.verificationCode,
    };
  } catch (err) {
    if (err?.code !== 'REPORT_NOT_FOUND') throw err;
  }

  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  await assertEnrollmentReportAccess(requester, enrollment);

  const report = await prisma.training_individual_reports.findFirst({
    where: { enrollment_id: enrollmentId },
    orderBy: { version: 'desc' },
  });
  if (!report) throw new ApiError(404, 'لا يوجد تقرير فردي لهذا المتدرب بعد.', null, 'INDIVIDUAL_REPORT_NOT_FOUND');
  return mapIndividualReportOut(report);
}

function mapCourseReportOut(report) {
  return {
    id: report.id,
    programId: report.program_id,
    cohortId: report.cohort_id,
    version: report.version,
    status: report.status,
    snapshot: report.snapshot_json,
    finalizationMode: report.finalization_mode,
    finalizationReason: report.finalization_reason,
    generatedAt: report.generated_at,
  };
}

async function assertProgramReportAccess(requester, program, programId) {
  assertOrganizationAccess(requester, program.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId, 'can_view_reports');
  } else {
    assertManagerAccess(requester);
  }
}

/** Builds and persists a versioned course-level report snapshot with rules-based recommendations. */
async function generateCourseReport(requester, programId, { cohortId, mode, reason } = {}) {
  const official = await officialReports.generateOfficialReport(requester, {
    reportType: REPORT_TYPES.COURSE,
    programId,
    cohortId,
    mode,
    reason,
  });
  return {
    id: official.id,
    programId: official.programId,
    cohortId: official.cohortId,
    version: official.version,
    status: official.status,
    snapshot: official.snapshot,
    finalizationMode: mode || null,
    finalizationReason: reason || null,
    generatedAt: official.generatedAt,
    referenceCode: official.referenceCode,
    verificationCode: official.verificationCode,
  };
}

async function getCourseReport(requester, programId, { cohortId } = {}) {
  try {
    const official = await officialReports.getLatestReport(requester, {
      reportType: REPORT_TYPES.COURSE,
      programId,
      cohortId,
    });
    return {
      id: official.id,
      programId: official.programId,
      cohortId: official.cohortId,
      version: official.version,
      status: official.status,
      snapshot: official.snapshot,
      finalizationMode: official.finalizationMode || null,
      finalizationReason: official.finalizationReason || null,
      generatedAt: official.generatedAt,
      referenceCode: official.referenceCode,
      verificationCode: official.verificationCode,
    };
  } catch (err) {
    if (err?.code !== 'REPORT_NOT_FOUND' && err?.errorCode !== 'REPORT_NOT_FOUND') throw err;
  }

  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  await assertProgramReportAccess(requester, program, programId);

  const report = await prisma.training_course_reports.findFirst({
    where: { program_id: programId, cohort_id: cohortId || null },
    orderBy: { version: 'desc' },
  });
  if (!report) throw new ApiError(404, 'لا يوجد تقرير للدورة بعد.', null, 'COURSE_REPORT_NOT_FOUND');
  return mapCourseReportOut(report);
}

/** Admin/super_admin only: reverts previously-completed enrollments back to REQUIREMENTS_COMPLETED and revokes any issued certificates. */
async function reopenTraining(requester, programId, { reason, enrollmentIds } = {}) {
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'إعادة فتح التدريب متاحة لمسؤولي المؤسسة فقط.', null, 'ROLE_NOT_ALLOWED');
  }
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    throw new ApiError(400, 'يجب إدخال سبب لإعادة فتح التدريب.', null, 'FINALIZATION_REASON_REQUIRED');
  }
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  assertOrganizationAccess(requester, program.organization_id);

  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: programId },
      status: 'COMPLETED',
      ...(Array.isArray(enrollmentIds) && enrollmentIds.length ? { id: { in: enrollmentIds } } : {}),
    },
  });
  if (!enrollments.length) {
    throw new ApiError(400, 'لا يوجد متدربون مكتملون لإعادة فتحهم.', null, 'NO_COMPLETED_ENROLLMENTS');
  }

  const reopened = [];
  for (const enrollment of enrollments) {
    await prisma.training_enrollments.update({
      where: { id: enrollment.id },
      data: { status: 'REQUIREMENTS_COMPLETED', status_reason: trimmedReason, updated_at: new Date() },
    });
    await prisma.training_progress.updateMany({
      where: { enrollment_id: enrollment.id },
      data: { status: 'PENDING_REVIEW', updated_at: new Date() },
    });
    await prisma.training_certificates.updateMany({
      where: { enrollment_id: enrollment.id, status: 'ISSUED' },
      data: { status: 'REVOKED', revoked_at: new Date(), updated_at: new Date() },
    });
    await emitDomainEvent('TRAINING_REOPENED', {
      organizationId: program.organization_id,
      affectedUserId: enrollment.user_id,
      entityType: 'training_enrollment',
      entityId: enrollment.id,
      templateVars: { course_title: program.title },
    }).catch(() => null);
    reopened.push(enrollment.id);
  }

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'TRAINING_REOPENED',
    entityType: 'training_program',
    entityId: programId,
    newValues: { reason: trimmedReason, enrollmentIds: reopened },
  });

  return { programId, reopened, reason: trimmedReason };
}

module.exports = {
  FINALIZATION_MODES,
  REPORT_THRESHOLDS,
  shouldIssueCertificateOnFinalize,
  deriveCompletionEligibility,
  calculateTrainingCompletionEligibility,
  getProgramCompletionReadiness,
  finalizeTraining,
  buildIndividualReportSnapshot,
  getIndividualReport,
  generateIndividualReport,
  getCourseReport,
  generateCourseReport,
  reopenTraining,
};
