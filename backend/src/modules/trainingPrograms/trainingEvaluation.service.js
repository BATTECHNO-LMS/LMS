'use strict';

/**
 * Institutional TRAINING_COURSE final evaluation (Kirkpatrick Level 1 — Reaction).
 * Level 2 Learning is measured by PRE_TEST vs POST_TEST, not this survey.
 * Levels 3/4 are reserved for future follow-up evaluations.
 * One evaluation assignment per enrollment, one response per assignment.
 * Assignment lifecycle: LOCKED -> AVAILABLE -> IN_PROGRESS -> SUBMITTED -> (REOPENED) -> CLOSED.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { isTrainerOnly, assertTrainerProgramAccess } = require('./trainerGuards');
const { recordAudit } = require('../../shared/services/audit.service');
const { emitDomainEvent } = require('../notificationEngine');
const { npsCategory, computeSectionScores, filterQuestionsForDeliveryMode, average, buildRatingDistribution, KIRKPATRICK } = require('./trainingEvaluation.scoring');

function isManagerRole(requester) {
  return (
    isSystemWideAdmin(requester) ||
    Boolean(requester?.roles?.includes('admin')) ||
    Boolean(requester?.roles?.includes('trainer')) ||
    Boolean(requester?.roles?.includes('reviewer'))
  );
}

async function findEnrollmentForProgram(userId, programId, organizationId) {
  return prisma.training_enrollments.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
      training_cohorts: { program_id: programId },
    },
  });
}

async function loadEnrollmentForEvaluation(enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } } },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  return enrollment;
}

async function loadTemplateWithSections(templateId) {
  const template = await prisma.training_evaluation_templates.findUnique({
    where: { id: templateId },
    include: {
      training_evaluation_sections: {
        orderBy: { sort_order: 'asc' },
        include: { training_evaluation_questions: { orderBy: { sort_order: 'asc' } } },
      },
    },
  });
  if (!template) throw new ApiError(404, 'قالب التقييم غير موجود', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  return template;
}

function mapQuestionOut(q) {
  return {
    id: q.id,
    code: q.code,
    prompt: q.prompt,
    questionType: q.question_type,
    isRequired: q.is_required,
    sortOrder: q.sort_order,
    scaleMin: q.scale_min,
    scaleMax: q.scale_max,
    scaleLabels: q.scale_labels_json,
    maxLength: q.max_length,
  };
}

function mapTemplateOut(template, { deliveryMode } = {}) {
  const sections = (template.training_evaluation_sections || [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      description: s.description,
      sortOrder: s.sort_order,
      indicatorKey: s.indicator_key,
      questions: filterQuestionsForDeliveryMode(s.training_evaluation_questions || [], deliveryMode)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(mapQuestionOut),
    }));
  return {
    id: template.id,
    code: template.code,
    title: template.title,
    description: template.description,
    deliveryMode: template.delivery_mode,
    version: template.version,
    sections,
  };
}

/** Flatten template sections into `{ ...question, section_code }` filtered by delivery mode. */
function flattenTemplateQuestions(template, deliveryMode) {
  const flat = [];
  for (const section of template.training_evaluation_sections || []) {
    const filtered = filterQuestionsForDeliveryMode(section.training_evaluation_questions || [], deliveryMode);
    for (const q of filtered) {
      flat.push({ ...q, section_code: section.code });
    }
  }
  return flat;
}

function mapResponseOut(response, assignmentStatus) {
  if (!response) return null;
  return {
    id: response.id,
    assignmentId: response.assignment_id,
    status: response.status,
    answers: response.answers_json || {},
    scores: response.scores_json || null,
    npsScore: response.nps_score,
    npsCategory: response.nps_category,
    overallReactionScore: response.overall_reaction_score != null ? Number(response.overall_reaction_score) : null,
    submittedAt: response.submitted_at,
    assignmentStatus: assignmentStatus || undefined,
  };
}

/**
 * Create/refresh the evaluation assignment for an enrollment (idempotent upsert).
 * When `forceUnlock` is true and the assignment is currently LOCKED (or missing),
 * it transitions to AVAILABLE. Returns null when the program has no active
 * evaluation template linked (evaluation not configured for this course).
 */
async function ensureEvaluationAssignment(enrollmentId, { forceUnlock = false } = {}) {
  const enrollment = await loadEnrollmentForEvaluation(enrollmentId);
  const program = enrollment.training_cohorts.training_programs;
  const link = await prisma.training_program_evaluation_links.findUnique({
    where: { program_id: program.id },
  });
  if (!link || !link.is_active) return null;

  const existing = await prisma.training_evaluation_assignments.findUnique({
    where: { enrollment_id: enrollmentId },
  });

  const templateMeta = await prisma.training_evaluation_templates.findUnique({
    where: { id: link.template_id },
    select: { delivery_mode: true },
  });
  const deliveryMode =
    enrollment.training_cohorts.delivery_mode ||
    program.delivery_mode ||
    templateMeta?.delivery_mode ||
    null;
  const willUnlock = forceUnlock && (!existing || existing.status === 'LOCKED');
  const baseData = {
    program_id: program.id,
    template_id: link.template_id,
    user_id: enrollment.user_id,
    organization_id: enrollment.organization_id,
    delivery_mode_effective: deliveryMode,
  };

  const row = await prisma.training_evaluation_assignments.upsert({
    where: { enrollment_id: enrollmentId },
    create: {
      ...baseData,
      enrollment_id: enrollmentId,
      status: willUnlock ? 'AVAILABLE' : 'LOCKED',
      available_at: willUnlock ? new Date() : null,
    },
    update: {
      ...baseData,
      ...(willUnlock ? { status: 'AVAILABLE', available_at: new Date() } : {}),
      updated_at: new Date(),
    },
  });
  return row;
}

/**
 * Called after a post-test attempt is submitted/graded. Keeps the evaluation
 * LOCKED while manual grading is pending; unlocks it (AVAILABLE) otherwise,
 * provided the program actually requires an EVALUATION.
 */
async function unlockEvaluationAfterPostTest(enrollmentId, { pendingManual = false } = {}) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: { training_cohorts: { include: { training_programs: true } } },
  });
  if (!enrollment) return { available: false };
  const program = enrollment.training_cohorts.training_programs;

  const requirement = await prisma.training_requirements.findUnique({
    where: { program_id_code: { program_id: program.id, code: 'EVALUATION' } },
  });
  if (!requirement?.is_required) return { available: false, reason: 'NOT_REQUIRED' };

  if (pendingManual) {
    await ensureEvaluationAssignment(enrollmentId, { forceUnlock: false });
    return { available: false, reason: 'POST_TEST_GRADING_PENDING' };
  }

  const postReq = await prisma.training_requirements.findUnique({
    where: { program_id_code: { program_id: program.id, code: 'POST_TEST' } },
  });
  const threshold = postReq?.threshold_json && typeof postReq.threshold_json === 'object' ? postReq.threshold_json : {};
  const passingRequired = threshold.passing_required === true;
  if (passingRequired) {
    const assessment = await prisma.training_assessments.findFirst({
      where: { program_id: program.id, kind: 'POST_TEST' },
      include: {
        training_assessment_attempts: {
          where: { enrollment_id: enrollmentId, status: 'GRADED' },
          select: { score: true },
        },
      },
    });
    const passScoreRaw = assessment?.pass_score ?? threshold.pass_score;
    const passScore = passScoreRaw != null ? Number(passScoreRaw) : null;
    const best = (assessment?.training_assessment_attempts || []).reduce(
      (max, a) => Math.max(max, Number(a.score || 0)),
      0
    );
    const passed = passScore == null ? best > 0 : best >= passScore;
    if (!passed) {
      await ensureEvaluationAssignment(enrollmentId, { forceUnlock: false });
      return { available: false, reason: 'POST_TEST_NOT_PASSED' };
    }
  }

  const before = await prisma.training_evaluation_assignments.findUnique({ where: { enrollment_id: enrollmentId } });
  const assignment = await ensureEvaluationAssignment(enrollmentId, { forceUnlock: true });
  if (!assignment) return { available: false };

  const justUnlocked = (!before || before.status === 'LOCKED') && assignment.status === 'AVAILABLE';
  if (justUnlocked) {
    await emitDomainEvent('FINAL_EVALUATION_AVAILABLE', {
      organizationId: enrollment.organization_id,
      affectedUserId: enrollment.user_id,
      entityType: 'training_evaluation_assignment',
      entityId: assignment.id,
      templateVars: { course_title: program.title },
    }).catch(() => null);
  }

  return {
    available: ['AVAILABLE', 'IN_PROGRESS', 'SUBMITTED'].includes(assignment.status),
    assignmentId: assignment.id,
    status: assignment.status,
  };
}

/**
 * Full evaluation state for one enrollment: assignment, template (delivery-mode
 * filtered), and the trainee's response (if any). The owning trainee auto-starts
 * the evaluation (AVAILABLE -> IN_PROGRESS + draft response) on first fetch.
 */
async function getEnrollmentEvaluation(requester, enrollmentId) {
  const enrollment = await loadEnrollmentForEvaluation(enrollmentId);
  assertOrganizationAccess(requester, enrollment.organization_id);
  const isOwner = enrollment.user_id === requester.userId;
  if (!isOwner) {
    if (isTrainerOnly(requester)) {
      await assertTrainerProgramAccess(requester, enrollment.training_cohorts.training_programs.id, 'can_view_progress');
    } else if (
      !isSystemWideAdmin(requester) &&
      !requester.roles?.includes('admin') &&
      !requester.roles?.includes('reviewer')
    ) {
      throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
    }
  }

  let assignment = await prisma.training_evaluation_assignments.findUnique({
    where: { enrollment_id: enrollmentId },
    include: { training_evaluation_responses: true },
  });
  if (!assignment) {
    const created = await ensureEvaluationAssignment(enrollmentId, {});
    if (!created) {
      throw new ApiError(404, 'لا يوجد تقييم نهائي مرتبط بهذه الدورة', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
    }
    assignment = await prisma.training_evaluation_assignments.findUnique({
      where: { enrollment_id: enrollmentId },
      include: { training_evaluation_responses: true },
    });
  }

  if (isOwner && assignment.status === 'AVAILABLE') {
    await prisma.training_evaluation_responses.upsert({
      where: { assignment_id: assignment.id },
      create: {
        assignment_id: assignment.id,
        enrollment_id: enrollmentId,
        user_id: enrollment.user_id,
        status: 'DRAFT',
        answers_json: {},
      },
      update: {},
    });
    assignment = await prisma.training_evaluation_assignments.update({
      where: { id: assignment.id },
      data: { status: 'IN_PROGRESS', started_at: assignment.started_at || new Date(), updated_at: new Date() },
      include: { training_evaluation_responses: true },
    });
    await emitDomainEvent('FINAL_EVALUATION_STARTED', {
      organizationId: enrollment.organization_id,
      affectedUserId: enrollment.user_id,
      entityType: 'training_evaluation_assignment',
      entityId: assignment.id,
    }).catch(() => null);
  }

  if (isOwner && assignment.status === 'LOCKED') {
    throw new ApiError(
      403,
      'يصبح التقييم النهائي متاحًا بعد استكمال الاختبار البعدي.',
      null,
      'FINAL_EVALUATION_LOCKED'
    );
  }

  const link = await prisma.training_program_evaluation_links.findUnique({
    where: { program_id: assignment.program_id },
  });
  const template = await loadTemplateWithSections(assignment.template_id);

  return {
    enrollmentId,
    programId: assignment.program_id,
    assignmentId: assignment.id,
    status: assignment.status,
    availableAt: assignment.available_at,
    startedAt: assignment.started_at,
    submittedAt: assignment.submitted_at,
    reopenReason: assignment.reopen_reason,
    deliveryMode: assignment.delivery_mode_effective,
    isRequired: Boolean(link?.is_required),
    template: mapTemplateOut(template, { deliveryMode: assignment.delivery_mode_effective }),
    response: mapResponseOut(assignment.training_evaluation_responses, assignment.status),
  };
}

/**
 * Managers get the program's configured template (setup/preview view).
 * Trainees are redirected to their own enrollment evaluation.
 */
async function getProgramEvaluation(requester, programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  assertOrganizationAccess(requester, program.organization_id);

  if (isManagerRole(requester)) {
    if (isTrainerOnly(requester)) {
      await assertTrainerProgramAccess(requester, programId);
    }
    const link = await prisma.training_program_evaluation_links.findUnique({ where: { program_id: programId } });
    if (!link) {
      return { programId, isConfigured: false, isRequired: false, isActive: false, template: null };
    }
    const template = await loadTemplateWithSections(link.template_id);
    const aggregates = await getEvaluationAggregates(programId);
    return {
      programId,
      isConfigured: true,
      isRequired: link.is_required,
      isActive: link.is_active,
      kirkpatrick: {
        level1: KIRKPATRICK.FINAL_EVALUATION,
        level2: KIRKPATRICK.PRE_POST_TESTS,
        level3: KIRKPATRICK.FOLLOW_UP_BEHAVIOR,
        level4: KIRKPATRICK.FOLLOW_UP_RESULTS,
      },
      template: mapTemplateOut(template, { deliveryMode: program.delivery_mode || template.delivery_mode }),
      ...aggregates,
      stats: {
        responseRate: aggregates.responseRate,
        submittedCount: aggregates.totalSubmitted,
        assignedCount: aggregates.totalAssignments,
        nps: aggregates.nps?.index,
        averageRating: aggregates.averages?.overall_reaction_score,
      },
    };
  }

  const enrollment = await findEnrollmentForProgram(requester.userId, programId, program.organization_id);
  if (!enrollment) {
    throw new ApiError(403, 'يلزم التسجيل في الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
  }
  return getEnrollmentEvaluation(requester, enrollment.id);
}

/** Trainee-only draft autosave (answers_json). Ownership is enforced from the response row, never from client input. */
async function saveDraft(requester, responseId, answers) {
  const response = await prisma.training_evaluation_responses.findUnique({
    where: { id: responseId },
    include: { training_evaluation_assignments: true },
  });
  if (!response) throw new ApiError(404, 'الاستبيان غير موجود', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  if (response.user_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  if (response.status === 'SUBMITTED') {
    throw new ApiError(400, 'تم إرسال التقييم بالفعل ولا يمكن تعديله.', null, 'FINAL_EVALUATION_ALREADY_SUBMITTED');
  }
  const assignment = response.training_evaluation_assignments;
  if (!['AVAILABLE', 'IN_PROGRESS', 'REOPENED'].includes(assignment.status)) {
    throw new ApiError(403, 'التقييم النهائي غير متاح حاليًا.', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  }

  const updated = await prisma.training_evaluation_responses.update({
    where: { id: responseId },
    data: { answers_json: answers && typeof answers === 'object' ? answers : {}, updated_at: new Date() },
  });

  if (assignment.status === 'AVAILABLE') {
    await prisma.training_evaluation_assignments.update({
      where: { id: assignment.id },
      data: { status: 'IN_PROGRESS', started_at: assignment.started_at || new Date(), updated_at: new Date() },
    });
  }

  return mapResponseOut(updated, assignment.status === 'AVAILABLE' ? 'IN_PROGRESS' : assignment.status);
}

/** Validates required questions, scores the response, marks it immutable, and recomputes enrollment progress. */
async function submitEvaluation(requester, responseId, answers) {
  const response = await prisma.training_evaluation_responses.findUnique({
    where: { id: responseId },
    include: {
      training_evaluation_assignments: {
        include: {
          training_evaluation_templates: {
            include: {
              training_evaluation_sections: {
                include: { training_evaluation_questions: true },
              },
            },
          },
        },
      },
    },
  });
  if (!response) throw new ApiError(404, 'الاستبيان غير موجود', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  if (response.user_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  if (response.status === 'SUBMITTED') {
    return mapResponseOut(response, response.training_evaluation_assignments.status);
  }
  const assignment = response.training_evaluation_assignments;
  if (!['AVAILABLE', 'IN_PROGRESS', 'REOPENED'].includes(assignment.status)) {
    throw new ApiError(403, 'التقييم النهائي غير متاح حاليًا.', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  }

  const finalAnswers = answers && typeof answers === 'object' ? answers : response.answers_json || {};
  const flatQuestions = flattenTemplateQuestions(assignment.training_evaluation_templates, assignment.delivery_mode_effective);

  const missing = [];
  const answersByQuestionId = {};
  for (const q of flatQuestions) {
    const raw = finalAnswers[q.id];
    if (q.question_type === 'OPEN_TEXT') {
      const text = raw && typeof raw === 'object' ? raw.text : raw;
      const trimmed = text == null ? '' : String(text).trim();
      if (q.is_required && !trimmed) missing.push(q.id);
      if (raw !== undefined) answersByQuestionId[q.id] = { text: trimmed };
    } else {
      const value = raw && typeof raw === 'object' ? raw.value ?? raw.numeric_value : raw;
      const numeric = value == null || value === '' ? null : Number(value);
      if (q.is_required && (numeric == null || Number.isNaN(numeric))) missing.push(q.id);
      if (raw !== undefined && numeric != null && !Number.isNaN(numeric)) {
        answersByQuestionId[q.id] = { value: numeric };
      }
    }
  }
  if (missing.length) {
    throw new ApiError(
      400,
      'يرجى الإجابة على جميع الأسئلة المطلوبة قبل إرسال التقييم.',
      { missingQuestionIds: missing },
      'FINAL_EVALUATION_VALIDATION_FAILED'
    );
  }

  const scores = computeSectionScores(flatQuestions, answersByQuestionId);

  const answerRows = flatQuestions
    .map((q) => {
      const a = answersByQuestionId[q.id];
      if (!a) return null;
      return {
        response_id: response.id,
        question_id: q.id,
        numeric_value: q.question_type === 'OPEN_TEXT' ? null : a.value,
        text_value: q.question_type === 'OPEN_TEXT' ? a.text : null,
        nps_category: q.question_type === 'NPS' ? npsCategory(a.value) : null,
      };
    })
    .filter(Boolean);

  const { updatedResponse, updatedAssignment } = await prisma.$transaction(
    async (tx) => {
      await tx.training_evaluation_answers.deleteMany({ where: { response_id: response.id } });
      if (answerRows.length) {
        await tx.training_evaluation_answers.createMany({ data: answerRows });
      }
      const updatedResponseRow = await tx.training_evaluation_responses.update({
        where: { id: response.id },
        data: {
          answers_json: finalAnswers,
          scores_json: scores,
          nps_score: scores.nps_score,
          nps_category: scores.nps_category,
          overall_reaction_score: scores.overall_reaction_score,
          status: 'SUBMITTED',
          submitted_at: new Date(),
          updated_at: new Date(),
        },
      });
      const updatedAssignmentRow = await tx.training_evaluation_assignments.update({
        where: { id: assignment.id },
        data: { status: 'SUBMITTED', submitted_at: new Date(), updated_at: new Date() },
      });
      return { updatedResponse: updatedResponseRow, updatedAssignment: updatedAssignmentRow };
    },
    { maxWait: 15000, timeout: 60000 }
  );

  await emitDomainEvent('FINAL_EVALUATION_SUBMITTED', {
    organizationId: assignment.organization_id,
    affectedUserId: response.user_id,
    entityType: 'training_evaluation_response',
    entityId: response.id,
  }).catch(() => null);

  try {
    const { recomputeProgress } = require('./trainingPrograms.service');
    await recomputeProgress(requester, assignment.enrollment_id);
  } catch {
    /* progress recompute is best-effort */
  }

  return mapResponseOut(updatedResponse, updatedAssignment.status);
}

/** Admin/super_admin only: reopens a SUBMITTED/CLOSED evaluation so the trainee can resubmit it. */
async function reopenEvaluation(requester, assignmentId, reason) {
  if (!isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    throw new ApiError(403, 'إعادة فتح التقييم متاحة لمسؤول المؤسسة فقط.', null, 'ROLE_NOT_ALLOWED');
  }
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    throw new ApiError(400, 'يجب إدخال سبب لإعادة فتح التقييم.', null, 'FINAL_EVALUATION_VALIDATION_FAILED');
  }
  const assignment = await prisma.training_evaluation_assignments.findUnique({
    where: { id: assignmentId },
    include: { training_evaluation_responses: true },
  });
  if (!assignment) throw new ApiError(404, 'التقييم غير موجود', null, 'FINAL_EVALUATION_NOT_AVAILABLE');
  assertOrganizationAccess(requester, assignment.organization_id);
  if (!['SUBMITTED', 'CLOSED'].includes(assignment.status)) {
    throw new ApiError(400, 'لا يمكن إعادة فتح تقييم لم يتم إرساله بعد.', null, 'FINAL_EVALUATION_VALIDATION_FAILED');
  }

  const updated = await prisma.training_evaluation_assignments.update({
    where: { id: assignmentId },
    data: {
      status: 'REOPENED',
      reopened_at: new Date(),
      reopen_reason: trimmedReason,
      reopened_by: requester.userId,
      updated_at: new Date(),
    },
  });
  if (assignment.training_evaluation_responses) {
    await prisma.training_evaluation_responses.update({
      where: { id: assignment.training_evaluation_responses.id },
      data: { status: 'DRAFT', updated_at: new Date() },
    });
  }

  await recordAudit({
    userId: requester.userId,
    organizationId: assignment.organization_id,
    actionType: 'FINAL_EVALUATION_REOPENED',
    entityType: 'training_evaluation_assignment',
    entityId: assignment.id,
    newValues: { reason: trimmedReason },
  });

  return { id: updated.id, status: updated.status, reopenReason: updated.reopen_reason };
}

/** Aggregated scores/response-rate/NPS/question distributions for a program's submitted evaluations. */
async function getEvaluationAggregates(programId) {
  const [responses, totalAssignments] = await Promise.all([
    prisma.training_evaluation_responses.findMany({
      where: { training_evaluation_assignments: { program_id: programId }, status: 'SUBMITTED' },
      include: {
        training_evaluation_answers: {
          include: {
            training_evaluation_questions: {
              include: { training_evaluation_sections: true },
            },
          },
        },
      },
    }),
    prisma.training_evaluation_assignments.count({ where: { program_id: programId } }),
  ]);

  const totalSubmitted = responses.length;
  const scoresList = responses.map((r) => (r.scores_json && typeof r.scores_json === 'object' ? r.scores_json : {}));
  const avgField = (field) => average(scoresList.map((s) => (typeof s[field] === 'number' ? s[field] : null)));

  const npsScores = responses.map((r) => r.nps_score).filter((v) => v != null).map((v) => Number(v));
  const nps = require('./trainingReportMetrics.service').computeNps(npsScores);

  const byQuestion = new Map();
  for (const response of responses) {
    for (const answer of response.training_evaluation_answers || []) {
      const q = answer.training_evaluation_questions;
      if (!q) continue;
      if (!byQuestion.has(q.id)) {
        byQuestion.set(q.id, {
          questionId: q.id,
          code: q.code,
          prompt: q.prompt,
          questionType: q.question_type,
          sectionCode: q.training_evaluation_sections?.code || null,
          sectionTitle: q.training_evaluation_sections?.title || null,
          numericValues: [],
          texts: [],
        });
      }
      const bucket = byQuestion.get(q.id);
      if (q.question_type === 'OPEN_TEXT') {
        const text = answer.text_value && String(answer.text_value).trim();
        if (text) bucket.texts.push(text);
      } else if (answer.numeric_value != null) {
        bucket.numericValues.push(Number(answer.numeric_value));
      }
    }
  }

  const questions = [...byQuestion.values()].map((q) => {
    if (q.questionType === 'OPEN_TEXT') {
      return {
        questionId: q.questionId,
        code: q.code,
        prompt: q.prompt,
        questionType: q.questionType,
        sectionCode: q.sectionCode,
        sectionTitle: q.sectionTitle,
        n: q.texts.length,
        comments: q.texts,
      };
    }
    const dist = buildRatingDistribution(
      q.numericValues,
      q.questionType === 'NPS' ? 0 : 1,
      q.questionType === 'NPS' ? 10 : 5
    );
    return {
      questionId: q.questionId,
      code: q.code,
      prompt: q.prompt,
      questionType: q.questionType,
      sectionCode: q.sectionCode,
      sectionTitle: q.sectionTitle,
      ...dist,
    };
  });

  const ratingQuestions = questions.filter((q) => q.questionType === 'RATING_SCALE' && q.n > 0);
  const ranked = [...ratingQuestions].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

  const comments = questions
    .filter((q) => q.questionType === 'OPEN_TEXT')
    .map((q) => ({
      questionCode: q.code,
      prompt: q.prompt,
      sectionTitle: q.sectionTitle,
      count: q.n,
      comments: q.comments,
    }));

  const averages = {
    trainer_score: avgField('trainer_score'),
    content_score: avgField('content_score'),
    activities_score: avgField('activities_score'),
    venue_score: avgField('venue_score'),
    technical_environment_score: avgField('technical_environment_score'),
    organization_score: avgField('organization_score'),
    immediate_impact_score: avgField('immediate_impact_score'),
    overall_reaction_score: avgField('overall_reaction_score'),
  };

  return {
    programId,
    sampleSize: totalSubmitted,
    totalAssignments,
    totalSubmitted,
    responseRate: totalAssignments ? Math.round((totalSubmitted / totalAssignments) * 10000) / 100 : 0,
    averages,
    nps: {
      average: average(npsScores),
      index: nps.index,
      promoters: nps.promoters,
      passives: nps.passives,
      detractors: nps.detractors,
      promotersPct: nps.promotersPct,
      passivesPct: nps.passivesPct,
      detractorsPct: nps.detractorsPct,
      totalResponses: nps.totalResponses,
      note: nps.note,
    },
    questions,
    highestRated: ranked.slice(0, 3).map((q) => ({ code: q.code, prompt: q.prompt, average: q.average, n: q.n })),
    lowestRated: ranked.slice(-3).reverse().map((q) => ({ code: q.code, prompt: q.prompt, average: q.average, n: q.n })),
    comments,
    kirkpatrickLevel1: {
      label: 'المستوى الأول — Reaction',
      note: 'تقييم رد الفعل الفوري للمتدربين. لا يُعد دليلًا على تغيّر السلوك الوظيفي أو النتائج التشغيلية.',
      averages,
      nps: {
        index: nps.index,
        promotersPct: nps.promotersPct,
        passivesPct: nps.passivesPct,
        detractorsPct: nps.detractorsPct,
        totalResponses: nps.totalResponses,
      },
      sampleSize: totalSubmitted,
    },
  };
}

module.exports = {
  getProgramEvaluation,
  getEnrollmentEvaluation,
  ensureEvaluationAssignment,
  unlockEvaluationAfterPostTest,
  saveDraft,
  submitEvaluation,
  reopenEvaluation,
  getEvaluationAggregates,
  mapTemplateOut,
  mapResponseOut,
  KIRKPATRICK,
};
