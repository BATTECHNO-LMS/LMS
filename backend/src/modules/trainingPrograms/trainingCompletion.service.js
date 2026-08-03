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
const { average } = require('./trainingEvaluation.scoring');
const evaluationService = require('./trainingEvaluation.service');

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

  const snapshot = await buildIndividualReportSnapshot(enrollmentId);
  const lastReport = await prisma.training_individual_reports.findFirst({
    where: { enrollment_id: enrollmentId },
    orderBy: { version: 'desc' },
  });
  const report = await prisma.training_individual_reports.create({
    data: {
      enrollment_id: enrollmentId,
      program_id: program.id,
      organization_id: enrollment.organization_id,
      version: (lastReport?.version || 0) + 1,
      status: 'GENERATED',
      snapshot_json: snapshot,
      summary_text: snapshot.summary,
      generated_by: requester.userId,
    },
  });

  const settings = program.settings_json && typeof program.settings_json === 'object' ? program.settings_json : {};
  let certificate = null;
  if (settings.certificateEnabled !== false) {
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
    entityId: report.id,
  }).catch(() => null);

  return { enrollmentId, reportId: report.id, certificate };
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
      await emitDomainEvent('TRAINING_NOT_COMPLETED', {
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
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } }, training_progress: true },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  const program = enrollment.training_cohorts.training_programs;

  const [user, sessions, attendanceRecords, tasks, submissions, assessments, evaluationAssignment, certificate] =
    await Promise.all([
      prisma.users.findUnique({ where: { id: enrollment.user_id }, select: { id: true, full_name: true, email: true, phone: true } }),
      prisma.training_sessions.findMany({ where: { cohort_id: enrollment.cohort_id } }),
      prisma.training_attendance_records.findMany({ where: { enrollment_id: enrollmentId } }),
      prisma.training_tasks.findMany({ where: { program_id: program.id } }),
      prisma.training_task_submissions.findMany({ where: { enrollment_id: enrollmentId } }),
      prisma.training_assessments.findMany({
        where: { program_id: program.id, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
        include: { training_assessment_attempts: { where: { enrollment_id: enrollmentId } } },
      }),
      prisma.training_evaluation_assignments.findUnique({ where: { enrollment_id: enrollmentId } }),
      prisma.training_certificates.findFirst({ where: { enrollment_id: enrollmentId, status: 'ISSUED' }, orderBy: { issued_at: 'desc' } }),
    ]);

  const presentLike = attendanceRecords.filter((a) => ['present', 'late', 'excused'].includes(String(a.status).toLowerCase()));
  const attendancePct = sessions.length ? Math.round((presentLike.length / sessions.length) * 10000) / 100 : null;
  const hoursCompleted = presentLike.reduce((sum, a) => {
    const session = sessions.find((s) => s.id === a.session_id);
    return sum + Number(session?.hours || 0);
  }, 0);

  function bestGradedScore(assessment) {
    const graded = (assessment?.training_assessment_attempts || []).filter((a) => a.status === 'GRADED');
    if (!graded.length) return null;
    return Math.max(...graded.map((a) => Number(a.score || 0)));
  }
  const preTest = assessments.find((a) => a.kind === 'PRE_TEST');
  const postTest = assessments.find((a) => a.kind === 'POST_TEST');
  const preScore = bestGradedScore(preTest);
  const postScore = bestGradedScore(postTest);

  const requiredTasks = tasks.filter((t) => t.is_required);
  const completedTaskIds = new Set(
    submissions.filter((s) => ['ACCEPTED', 'GRADED'].includes(s.status)).map((s) => s.task_id)
  );
  const finalTask = tasks.find((t) => t.is_final_task);
  const finalTaskSubmission = finalTask ? submissions.find((s) => s.task_id === finalTask.id) : null;
  const evaluationSubmitted = evaluationAssignment?.status === 'SUBMITTED';

  const summaryParts = [];
  summaryParts.push(
    `أكمل المتدرب نسبة حضور ${attendancePct != null ? attendancePct + '%' : 'غير محددة'} من الجلسات المقررة.`
  );
  if (preScore != null && postScore != null) {
    const diff = Math.round((postScore - preScore) * 100) / 100;
    if (diff > 0) {
      summaryParts.push(`أظهر تحسنًا في الاختبار البعدي بمقدار ${diff} نقطة مقارنة بالاختبار القبلي.`);
    } else if (diff < 0) {
      summaryParts.push('لم يظهر تحسنًا ملحوظًا في الاختبار البعدي مقارنة بالاختبار القبلي.');
    } else {
      summaryParts.push('حافظ على نفس مستوى الأداء بين الاختبارين القبلي والبعدي.');
    }
  } else if (postScore != null) {
    summaryParts.push(`حصل المتدرب على ${postScore}% في الاختبار البعدي.`);
  }
  summaryParts.push(
    requiredTasks.length
      ? `أنجز المتدرب ${completedTaskIds.size} من أصل ${requiredTasks.length} من المهمات المطلوبة.`
      : 'لا توجد مهمات مطلوبة في هذه الدورة.'
  );
  summaryParts.push(
    evaluationSubmitted
      ? 'أرسل المتدرب استبيان التقييم النهائي للدورة.'
      : 'لم يرسل المتدرب استبيان التقييم النهائي للدورة.'
  );
  summaryParts.push(
    enrollment.status === 'COMPLETED'
      ? 'تم اعتماد إكمال المتدرب لمتطلبات الدورة التدريبية.'
      : 'لم يتم بعد اعتماد إكمال المتدرب لجميع متطلبات الدورة التدريبية.'
  );

  return {
    identity: {
      userId: user?.id || enrollment.user_id,
      fullName: user?.full_name || null,
      email: user?.email || null,
      phone: user?.phone || null,
      enrollmentId,
      cohortId: enrollment.cohort_id,
      cohortName: enrollment.training_cohorts.name,
      programId: program.id,
      programTitle: program.title,
    },
    attendance: {
      totalSessions: sessions.length,
      attendedSessions: presentLike.length,
      attendancePct,
      hoursCompleted,
      hoursRequired: program.required_hours != null ? Number(program.required_hours) : null,
    },
    learning: {
      preTestScore: preScore,
      postTestScore: postScore,
      improvement: preScore != null && postScore != null ? Math.round((postScore - preScore) * 100) / 100 : null,
    },
    tasks: {
      requiredCount: requiredTasks.length,
      completedCount: completedTaskIds.size,
      finalTask: finalTask
        ? {
            title: finalTask.title,
            submitted: Boolean(finalTaskSubmission),
            score: finalTaskSubmission?.score != null ? Number(finalTaskSubmission.score) : null,
          }
        : null,
    },
    evaluation: { submitted: evaluationSubmitted },
    completion: {
      status: enrollment.status,
      completedAt: enrollment.completed_at,
      completionPct: enrollment.training_progress ? Number(enrollment.training_progress.completion_pct) : null,
    },
    certificate: certificate
      ? { issued: true, certificateNumber: certificate.certificate_number, issuedAt: certificate.issued_at }
      : { issued: false },
    summary: summaryParts.join(' '),
    generatedAt: new Date().toISOString(),
  };
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

async function getIndividualReport(requester, enrollmentId) {
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

async function generateIndividualReport(requester, enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  assertOrganizationAccess(requester, enrollment.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, enrollment.training_cohorts.training_programs.id, 'can_view_reports');
  } else {
    assertManagerAccess(requester);
  }

  const snapshot = await buildIndividualReportSnapshot(enrollmentId);
  const lastReport = await prisma.training_individual_reports.findFirst({
    where: { enrollment_id: enrollmentId },
    orderBy: { version: 'desc' },
  });
  const report = await prisma.training_individual_reports.create({
    data: {
      enrollment_id: enrollmentId,
      program_id: enrollment.training_cohorts.training_programs.id,
      organization_id: enrollment.organization_id,
      version: (lastReport?.version || 0) + 1,
      status: 'GENERATED',
      snapshot_json: snapshot,
      summary_text: snapshot.summary,
      generated_by: requester.userId,
    },
  });
  await emitDomainEvent('INDIVIDUAL_REPORT_GENERATED', {
    organizationId: enrollment.organization_id,
    affectedUserId: enrollment.user_id,
    entityType: 'training_individual_report',
    entityId: report.id,
  }).catch(() => null);
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
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  await assertProgramReportAccess(requester, program, programId);

  const enrollments = await prisma.training_enrollments.findMany({
    where: { training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) } },
  });
  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const notCompleted = enrollments.filter((e) => e.status === 'NOT_COMPLETED').length;
  const withdrawn = enrollments.filter((e) => e.status === 'WITHDRAWN').length;
  const active = enrollments.filter((e) => ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED'].includes(e.status)).length;

  const progressRows = await prisma.training_progress.findMany({
    where: { training_enrollments: { training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) } } },
    select: { attendance_pct: true },
  });
  const avgAttendance = average(progressRows.map((p) => (p.attendance_pct != null ? Number(p.attendance_pct) : null)));

  const evaluationAggregates = await evaluationService.getEvaluationAggregates(programId);

  const recommendations = [];
  if (avgAttendance != null && avgAttendance < REPORT_THRESHOLDS.LOW_ATTENDANCE_PCT) {
    recommendations.push('يوصى بمراجعة جدولة الجلسات وأساليب التحفيز لرفع نسبة الحضور العامة.');
  }
  if (evaluationAggregates.nps.index != null && evaluationAggregates.nps.index < REPORT_THRESHOLDS.LOW_NPS_INDEX) {
    recommendations.push('مؤشر صافي الترويج سلبي؛ يوصى بمراجعة تجربة المتدربين العامة قبل الدفعة القادمة.');
  }
  if (
    evaluationAggregates.averages.trainer_score != null &&
    evaluationAggregates.averages.trainer_score < REPORT_THRESHOLDS.LOW_TRAINER_SCORE
  ) {
    recommendations.push('تقييم المدرب أقل من المستوى المستهدف؛ يوصى بمراجعة أداء المدرب أو تزويده بدعم إضافي.');
  }
  if (
    evaluationAggregates.averages.content_score != null &&
    evaluationAggregates.averages.content_score < REPORT_THRESHOLDS.LOW_CONTENT_SCORE
  ) {
    recommendations.push('تقييم المحتوى التدريبي أقل من المستوى المستهدف؛ يوصى بتحديث المادة العلمية.');
  }
  const dropoutPct = total ? Math.round((withdrawn / total) * 10000) / 100 : 0;
  if (dropoutPct > REPORT_THRESHOLDS.HIGH_DROPOUT_PCT) {
    recommendations.push('نسبة الانسحاب من الدورة مرتفعة؛ يوصى بمراجعة أسباب الانسحاب مع المتدربين.');
  }
  if (!recommendations.length) {
    recommendations.push('مؤشرات الدورة ضمن المستوى المستهدف ولا توجد ملاحظات جوهرية حاليًا.');
  }

  const snapshot = {
    programId,
    programTitle: program.title,
    cohortId: cohortId || null,
    counts: { total, completed, notCompleted, withdrawn, active },
    completionRate: total ? Math.round((completed / total) * 10000) / 100 : 0,
    dropoutRate: dropoutPct,
    averageAttendancePct: avgAttendance,
    evaluation: evaluationAggregates,
    recommendations,
    generatedAt: new Date().toISOString(),
  };

  const lastReport = await prisma.training_course_reports.findFirst({
    where: { program_id: programId, cohort_id: cohortId || null },
    orderBy: { version: 'desc' },
  });
  const report = await prisma.training_course_reports.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      cohort_id: cohortId || null,
      version: (lastReport?.version || 0) + 1,
      status: 'GENERATED',
      snapshot_json: snapshot,
      generated_by: requester.userId,
      finalization_mode: mode || null,
      finalization_reason: reason || null,
    },
  });

  await emitDomainEvent('COURSE_REPORT_GENERATED', {
    organizationId: program.organization_id,
    entityType: 'training_course_report',
    entityId: report.id,
    templateVars: { course_title: program.title },
  }).catch(() => null);

  return mapCourseReportOut(report);
}

async function getCourseReport(requester, programId, { cohortId } = {}) {
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
