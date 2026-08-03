'use strict';

/**
 * Institutional TRAINING_COURSE assessments.
 * Reuses field-training question normalization & grading helpers (same engine logic),
 * persisted on training_assessments* (program/enrollment scoped — not field_training_* FKs).
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { emitDomainEvent } = require('../notificationEngine');
const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
  gradeAnswers,
  normalizeQuestionType,
} = require('../fieldTraining/fieldTraining.assessmentQuestions');

function requireOrgWrite(requester) {
  if (isSystemWideAdmin(requester)) return;
  if (requester.roles?.includes('reviewer')) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only', null, 'ROLE_NOT_ALLOWED');
  }
  if (
    !requester.roles?.includes('admin') &&
    !requester.roles?.includes('trainer') &&
    !requester.roles?.includes('instructor')
  ) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
}

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

function mapKind(kind) {
  if (kind === 'pre' || kind === 'PRE_TEST') return 'PRE_TEST';
  if (kind === 'post' || kind === 'POST_TEST') return 'POST_TEST';
  throw new ApiError(400, 'نوع الاختبار غير صالح', null, 'ASSESSMENT_NOT_FOUND');
}

function mapQuestionOut(q, { includeCorrect = false } = {}) {
  return {
    id: q.id,
    question_text: q.prompt,
    prompt: q.prompt,
    question_type: normalizeQuestionType(q.question_type) || 'multiple_choice',
    options: q.options_json,
    options_json: q.options_json,
    points: Number(q.points || 1),
    sort_order: q.sort_order,
    is_required: true,
    ...(includeCorrect ? { correct_answer: q.correct_answer } : {}),
  };
}

function mapAssessmentOut(row, { includeQuestions = false, includeCorrect = false } = {}) {
  return {
    id: row.id,
    programId: row.program_id,
    kind: row.kind,
    code: row.code || null,
    type: row.kind === 'PRE_TEST' ? 'pre' : 'post',
    title: row.title,
    description: row.instructions,
    instructions: row.instructions,
    durationMinutes: row.duration_minutes,
    maxAttempts: row.max_attempts,
    passingScore: row.pass_score != null ? Number(row.pass_score) : null,
    passScore: row.pass_score != null ? Number(row.pass_score) : null,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    shuffleQuestions: row.shuffle_questions,
    showResults: row.show_results,
    isPublished: row.is_published,
    status: row.is_published ? 'published' : 'draft',
    questionCount: row._count?.training_assessment_questions ?? row.training_assessment_questions?.length ?? 0,
    questions: includeQuestions
      ? (row.training_assessment_questions || [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((q) => mapQuestionOut(q, { includeCorrect }))
      : undefined,
    updatedAt: row.updated_at,
  };
}

async function loadProgram(programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  return program;
}

async function findEnrollmentForProgram(userId, programId, organizationId) {
  return prisma.training_enrollments.findFirst({
    where: {
      user_id: userId,
      organization_id: organizationId,
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
      training_cohorts: { program_id: programId },
    },
    include: { training_progress: true, training_cohorts: true },
  });
}

async function listProgramAssessments(requester, programId) {
  const program = await loadProgram(programId);
  assertOrganizationAccess(requester, program.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId);
  }
  const isManager =
    isSystemWideAdmin(requester) ||
    requester.roles?.includes('admin') ||
    requester.roles?.includes('trainer') ||
    requester.roles?.includes('reviewer');
  const isLearner =
    (requester.roles?.includes('trainee') || requester.roles?.includes('student')) && !isManager;
  if (isLearner) {
    const enrollment = await findEnrollmentForProgram(
      requester.userId,
      programId,
      program.organization_id
    );
    if (!enrollment) {
      throw new ApiError(403, 'يلزم التسجيل في الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
    }
  }
  const rows = await prisma.training_assessments.findMany({
    where: {
      program_id: programId,
      ...(isLearner ? { is_published: true } : {}),
    },
    include: {
      training_assessment_questions: { orderBy: { sort_order: 'asc' } },
      _count: { select: { training_assessment_questions: true, training_assessment_attempts: true } },
    },
    orderBy: { kind: 'asc' },
  });
  return rows.map((r) =>
    mapAssessmentOut(r, {
      includeQuestions: isManager,
      includeCorrect: isManager && !requester.roles?.includes('reviewer'),
    })
  );
}

async function getAssessment(requester, assessmentId) {
  const row = await prisma.training_assessments.findUnique({
    where: { id: assessmentId },
    include: {
      training_programs: true,
      training_assessment_questions: { orderBy: { sort_order: 'asc' } },
      _count: { select: { training_assessment_attempts: true } },
    },
  });
  if (!row || row.training_programs.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الاختبار غير موجود', null, 'ASSESSMENT_NOT_FOUND');
  }
  assertOrganizationAccess(requester, row.training_programs.organization_id);
  const isLearner =
    (requester.roles?.includes('trainee') || requester.roles?.includes('student')) &&
    !requester.roles?.includes('admin') &&
    !isSystemWideAdmin(requester) &&
    !requester.roles?.includes('trainer');
  if (isLearner) {
    if (!row.is_published) {
      throw new ApiError(403, 'الاختبار غير منشور', null, 'ASSESSMENT_NOT_PUBLISHED');
    }
    const enrollment = await findEnrollmentForProgram(
      requester.userId,
      row.program_id,
      row.training_programs.organization_id
    );
    if (!enrollment) {
      throw new ApiError(403, 'يلزم التسجيل في الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
    }
    if (row.kind === 'POST_TEST') {
      await assertPostTestEligible(requester, row, enrollment);
    }
  } else if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, row.program_id);
  }
  return mapAssessmentOut(row, {
    includeQuestions: true,
    includeCorrect: !isLearner,
  });
}

async function upsertAssessment(requester, programId, kindRaw, body = {}) {
  const kind = mapKind(kindRaw);
  const program = await loadProgram(programId);
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_assessments');

  let questionsPayload = null;
  if (Array.isArray(body.questions)) {
    const normalized = body.questions.map((q, i) => {
      const prepared = prepareQuestionForStorage(
        {
          question_text: q.question_text ?? q.prompt,
          question_type: q.question_type || 'multiple_choice',
          options: q.options ?? q.options_json,
          correct_answer: q.correct_answer,
          points: q.points,
          is_required: q.is_required,
          sort_order: i,
        },
        i
      );
      return prepared;
    });
    if (body.is_published || body.status === 'published') {
      const validation = validateAssessmentQuestions(
        normalized.map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
        }))
      );
      if (typeof validation === 'string') {
        throw new ApiError(400, validation);
      }
    }
    questionsPayload = normalized;
  }

  const isPublished =
    body.is_published === true ||
    body.status === 'published' ||
    (body.status === 'draft' ? false : body.is_published);

  const row = await prisma.training_assessments.upsert({
    where: { program_id_kind: { program_id: programId, kind } },
    create: {
      program_id: programId,
      kind,
      title: body.title || (kind === 'PRE_TEST' ? 'اختبار قبلي' : 'اختبار بعدي'),
      instructions: body.description ?? body.instructions ?? null,
      duration_minutes: body.duration_minutes ?? null,
      max_attempts: body.max_attempts ?? 1,
      pass_score: body.passing_score ?? body.pass_score ?? null,
      opens_at: body.opens_at ? new Date(body.opens_at) : null,
      closes_at: body.closes_at ? new Date(body.closes_at) : null,
      shuffle_questions: Boolean(body.shuffle_questions),
      show_results: body.show_results !== false,
      is_published: Boolean(isPublished),
    },
    update: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined || body.instructions !== undefined
        ? { instructions: body.description ?? body.instructions ?? null }
        : {}),
      ...(body.duration_minutes !== undefined ? { duration_minutes: body.duration_minutes } : {}),
      ...(body.max_attempts !== undefined ? { max_attempts: body.max_attempts } : {}),
      ...(body.passing_score !== undefined || body.pass_score !== undefined
        ? { pass_score: body.passing_score ?? body.pass_score }
        : {}),
      ...(body.opens_at !== undefined
        ? { opens_at: body.opens_at ? new Date(body.opens_at) : null }
        : {}),
      ...(body.closes_at !== undefined
        ? { closes_at: body.closes_at ? new Date(body.closes_at) : null }
        : {}),
      ...(body.shuffle_questions !== undefined
        ? { shuffle_questions: Boolean(body.shuffle_questions) }
        : {}),
      ...(body.show_results !== undefined ? { show_results: body.show_results !== false } : {}),
      ...(body.is_published !== undefined || body.status !== undefined
        ? { is_published: Boolean(isPublished) }
        : {}),
      updated_at: new Date(),
    },
  });

  if (questionsPayload) {
    await prisma.training_assessment_questions.deleteMany({ where: { assessment_id: row.id } });
    for (let i = 0; i < questionsPayload.length; i += 1) {
      const q = questionsPayload[i];
      await prisma.training_assessment_questions.create({
        data: {
          assessment_id: row.id,
          prompt: q.question_text,
          question_type: q.question_type,
          options_json: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          sort_order: i,
        },
      });
    }
  }

  if (row.is_published) {
    await emitDomainEvent(kind === 'PRE_TEST' ? 'PRE_TEST_AVAILABLE' : 'POST_TEST_AVAILABLE', {
      organizationId: program.organization_id,
      entityType: 'training_assessment',
      entityId: row.id,
      templateVars: { assessment_title: row.title, course_title: program.title },
    }).catch(() => null);
  }

  return getAssessment(requester, row.id);
}

async function publishAssessment(requester, assessmentId) {
  const row = await prisma.training_assessments.findUnique({
    where: { id: assessmentId },
    include: {
      training_programs: true,
      training_assessment_questions: true,
    },
  });
  if (!row || row.training_programs.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الاختبار غير موجود', null, 'ASSESSMENT_NOT_FOUND');
  }
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, row.training_programs.organization_id);
  await assertTrainerProgramAccess(requester, row.program_id, 'can_manage_assessments');

  const validation = validateAssessmentQuestions(
    row.training_assessment_questions.map((q) => ({
      question_text: q.prompt,
      question_type: q.question_type,
      options: q.options_json,
      correct_answer: q.correct_answer,
      points: q.points,
    }))
  );
  if (typeof validation === 'string') throw new ApiError(400, validation);

  const updated = await prisma.training_assessments.update({
    where: { id: assessmentId },
    data: { is_published: true, updated_at: new Date() },
  });
  await emitDomainEvent(row.kind === 'PRE_TEST' ? 'PRE_TEST_AVAILABLE' : 'POST_TEST_AVAILABLE', {
    organizationId: row.training_programs.organization_id,
    entityType: 'training_assessment',
    entityId: updated.id,
    templateVars: { assessment_title: updated.title },
  }).catch(() => null);
  return getAssessment(requester, assessmentId);
}

async function assertAvailability(assessment) {
  if (!assessment.is_published) {
    throw new ApiError(403, 'الاختبار غير منشور', null, 'ASSESSMENT_NOT_PUBLISHED');
  }
  const now = new Date();
  if (assessment.opens_at && now < assessment.opens_at) {
    throw new ApiError(403, 'لم يحن موعد الاختبار بعد.', null, 'ASSESSMENT_NOT_AVAILABLE');
  }
  if (assessment.closes_at && now > assessment.closes_at) {
    throw new ApiError(403, 'انتهت فترة إتاحة الاختبار.', null, 'ASSESSMENT_CLOSED');
  }
}

async function assertPostTestEligible(requester, assessment, enrollment) {
  const { recomputeProgress } = require('./trainingPrograms.service');
  const progress = await recomputeProgress(requester, enrollment.id);
  const reqs = progress.requirements || {};
  const blockers = [];
  if (reqs.attendance && !reqs.attendance.ok) blockers.push('الحضور');
  if (reqs.hours && !reqs.hours.ok) blockers.push('الساعات');
  if (reqs.tasks && !reqs.tasks.ok) blockers.push('المهمات');
  if (reqs.preTest && reqs.preTest.required && !reqs.preTest.ok) blockers.push('الاختبار القبلي');
  if (blockers.length) {
    throw new ApiError(
      403,
      'الاختبار البعدي غير متاح حاليًا. أكمل متطلبات الدورة المطلوبة أولًا.',
      { blockers, requirements: reqs },
      'ASSESSMENT_PREREQUISITES_INCOMPLETE'
    );
  }
  return progress;
}

async function startAttempt(requester, assessmentId) {
  const assessment = await prisma.training_assessments.findUnique({
    where: { id: assessmentId },
    include: {
      training_programs: true,
      training_assessment_questions: { orderBy: { sort_order: 'asc' } },
    },
  });
  if (!assessment || assessment.training_programs.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الاختبار غير موجود', null, 'ASSESSMENT_NOT_FOUND');
  }
  assertOrganizationAccess(requester, assessment.training_programs.organization_id);
  await assertAvailability(assessment);

  const enrollment = await findEnrollmentForProgram(
    requester.userId,
    assessment.program_id,
    assessment.training_programs.organization_id
  );
  if (!enrollment) {
    throw new ApiError(403, 'يلزم التسجيل في الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
  }
  if (assessment.kind === 'POST_TEST') {
    await assertPostTestEligible(requester, assessment, enrollment);
  }

  const inProgress = await prisma.training_assessment_attempts.findFirst({
    where: {
      assessment_id: assessmentId,
      enrollment_id: enrollment.id,
      status: 'IN_PROGRESS',
    },
  });
  if (inProgress) {
    return {
      attempt: mapAttempt(inProgress),
      assessment: mapAssessmentOut(assessment, { includeQuestions: true, includeCorrect: false }),
      resumed: true,
    };
  }

  const completedCount = await prisma.training_assessment_attempts.count({
    where: {
      assessment_id: assessmentId,
      enrollment_id: enrollment.id,
      status: { in: ['SUBMITTED', 'GRADED', 'EXPIRED'] },
    },
  });
  if (completedCount >= assessment.max_attempts) {
    throw new ApiError(400, 'أكملت جميع المحاولات المتاحة.', null, 'ASSESSMENT_ATTEMPTS_EXHAUSTED');
  }

  const row = await prisma.training_assessment_attempts.create({
    data: {
      assessment_id: assessmentId,
      enrollment_id: enrollment.id,
      user_id: requester.userId,
      attempt_no: completedCount + 1,
      status: 'IN_PROGRESS',
      answers_json: {},
      started_at: new Date(),
    },
  });

  return {
    attempt: mapAttempt(row),
    assessment: mapAssessmentOut(assessment, { includeQuestions: true, includeCorrect: false }),
    resumed: false,
  };
}

function mapAttempt(row) {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    enrollmentId: row.enrollment_id,
    attemptNo: row.attempt_no,
    status: row.status,
    answers: row.answers_json?.answers ?? row.answers_json ?? {},
    gradingDetails: row.answers_json?.gradingDetails ?? null,
    score: row.score != null ? Number(row.score) : null,
    maxScore: row.answers_json?.maxScore != null ? Number(row.answers_json.maxScore) : null,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
  };
}

async function saveAttemptAnswers(requester, attemptId, answers) {
  const attempt = await prisma.training_assessment_attempts.findUnique({
    where: { id: attemptId },
    include: { training_assessments: { include: { training_programs: true } } },
  });
  if (!attempt) throw new ApiError(404, 'المحاولة غير موجودة', null, 'ASSESSMENT_NOT_FOUND');
  if (attempt.user_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw new ApiError(400, 'لا يمكن تعديل إجابات محاولة مُرسلة', null, 'ASSESSMENT_ATTEMPT_ALREADY_SUBMITTED');
  }
  const assessment = attempt.training_assessments;
  if (assessment.duration_minutes && attempt.started_at) {
    const deadline = new Date(attempt.started_at.getTime() + assessment.duration_minutes * 60000);
    if (new Date() > deadline) {
      await prisma.training_assessment_attempts.update({
        where: { id: attemptId },
        data: { status: 'EXPIRED', updated_at: new Date() },
      });
      throw new ApiError(400, 'انتهت مدة الاختبار', null, 'ASSESSMENT_ATTEMPT_EXPIRED');
    }
  }
  const prev = attempt.answers_json && typeof attempt.answers_json === 'object' ? attempt.answers_json : {};
  const row = await prisma.training_assessment_attempts.update({
    where: { id: attemptId },
    data: {
      answers_json: { ...prev, answers: answers || {} },
      updated_at: new Date(),
    },
  });
  return mapAttempt(row);
}

async function submitAttempt(requester, attemptId, answers) {
  const attempt = await prisma.training_assessment_attempts.findUnique({
    where: { id: attemptId },
    include: {
      training_assessments: {
        include: {
          training_programs: true,
          training_assessment_questions: true,
        },
      },
    },
  });
  if (!attempt) throw new ApiError(404, 'المحاولة غير موجودة', null, 'ASSESSMENT_NOT_FOUND');
  if (attempt.user_id !== requester.userId) {
    throw new ApiError(403, 'Forbidden', null, 'ROLE_NOT_ALLOWED');
  }
  if (attempt.status !== 'IN_PROGRESS') {
    // Idempotent: return existing graded/submitted attempt
    if (['SUBMITTED', 'GRADED'].includes(attempt.status)) {
      return mapAttempt(attempt);
    }
    throw new ApiError(400, 'المحاولة غير قابلة للإرسال', null, 'ASSESSMENT_ATTEMPT_ALREADY_SUBMITTED');
  }

  const assessment = attempt.training_assessments;
  const finalAnswers =
    answers ||
    attempt.answers_json?.answers ||
    (attempt.answers_json && !attempt.answers_json.answers ? attempt.answers_json : {}) ||
    {};

  const questions = assessment.training_assessment_questions.map((q) => ({
    id: q.id,
    question_type: q.question_type,
    options: q.options_json,
    correct_answer: q.correct_answer,
    points: q.points,
  }));
  const graded = gradeAnswers(questions, finalAnswers);
  const pendingManual = graded.questionResults.some((r) => r.gradingStatus === 'pending_manual');
  const status = pendingManual ? 'SUBMITTED' : 'GRADED';

  const row = await prisma.training_assessment_attempts.update({
    where: { id: attemptId },
    data: {
      answers_json: {
        answers: finalAnswers,
        gradingDetails: graded.questionResults,
        maxScore: graded.maxPoints,
        scorePercent: graded.scorePercent,
      },
      score: graded.scorePercent,
      status,
      submitted_at: new Date(),
      graded_at: pendingManual ? null : new Date(),
      updated_at: new Date(),
    },
  });

  await emitDomainEvent(assessment.kind === 'PRE_TEST' ? 'PRE_TEST_SUBMITTED' : 'POST_TEST_SUBMITTED', {
    organizationId: assessment.training_programs.organization_id,
    affectedUserId: requester.userId,
    entityType: 'training_assessment_attempt',
    entityId: row.id,
  }).catch(() => null);

  if (pendingManual) {
    await emitDomainEvent('ASSESSMENT_MANUAL_REVIEW_REQUIRED', {
      organizationId: assessment.training_programs.organization_id,
      entityType: 'training_assessment_attempt',
      entityId: row.id,
    }).catch(() => null);
  }

  try {
    const { recomputeProgress } = require('./trainingPrograms.service');
    await recomputeProgress(requester, attempt.enrollment_id);
  } catch {
    /* progress best-effort */
  }

  let finalEvaluationAvailable = false;
  let nextAction = null;
  if (assessment.kind === 'POST_TEST') {
    try {
      const evaluation = require('./trainingEvaluation.service');
      const unlock = await evaluation.unlockEvaluationAfterPostTest(attempt.enrollment_id, { pendingManual });
      finalEvaluationAvailable = unlock?.available === true;
      nextAction = finalEvaluationAvailable ? 'FINAL_EVALUATION' : pendingManual ? 'WAIT_MANUAL_GRADING' : null;
    } catch {
      /* evaluation unlock is best-effort */
    }
  }

  return {
    ...mapAttempt(row),
    scorePercent: graded.scorePercent,
    passed:
      assessment.pass_score == null
        ? true
        : graded.scorePercent >= Number(assessment.pass_score),
    pendingManual,
    showResults: assessment.show_results,
    postTestSubmitted: assessment.kind === 'POST_TEST',
    manualGradingPending: pendingManual,
    finalEvaluationAvailable,
    nextAction,
  };
}

/** Legacy one-shot submit used by older clients */
async function submitAssessment(requester, assessmentId, answers) {
  const started = await startAttempt(requester, assessmentId);
  return submitAttempt(requester, started.attempt.id, answers);
}

async function gradeAttempt(requester, attemptId, body = {}) {
  const attempt = await prisma.training_assessment_attempts.findUnique({
    where: { id: attemptId },
    include: {
      training_assessments: {
        include: { training_programs: true, training_assessment_questions: true },
      },
    },
  });
  if (!attempt) throw new ApiError(404, 'المحاولة غير موجودة', null, 'ASSESSMENT_NOT_FOUND');
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, attempt.training_assessments.training_programs.organization_id);
  await assertTrainerProgramAccess(
    requester,
    attempt.training_assessments.program_id,
    'can_grade_assessments'
  );

  const questions = attempt.training_assessments.training_assessment_questions;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const existingDetails = attempt.answers_json?.gradingDetails || [];
  let details = Array.isArray(body.question_grades) ? body.question_grades : null;
  if (!details && body.grades && typeof body.grades === 'object') {
    details = Object.entries(body.grades).map(([questionId, g]) => ({
      questionId,
      awardedPoints: Number(g?.points ?? g?.awardedPoints ?? g ?? 0),
      feedback: g?.feedback || null,
    }));
  }
  if (!details) details = existingDetails;

  let scorePoints = 0;
  let maxPoints = 0;
  const merged = [];
  const gradedIds = new Set();
  for (const d of details) {
    const qid = d.questionId || d.question_id;
    const q = byId.get(qid);
    if (!q) continue;
    const max = Number(q.points || d.maxPoints || 0);
    const awarded = Number(d.awardedPoints ?? d.awarded_points ?? 0);
    maxPoints += max;
    scorePoints += awarded;
    gradedIds.add(qid);
    merged.push({
      questionId: qid,
      awardedPoints: awarded,
      maxPoints: max,
      gradingStatus: 'manual_graded',
      feedback: d.feedback || null,
    });
  }
  for (const existing of existingDetails) {
    if (gradedIds.has(existing.questionId)) continue;
    maxPoints += Number(existing.maxPoints || byId.get(existing.questionId)?.points || 0);
    scorePoints += Number(existing.awardedPoints || 0);
    merged.push(existing);
  }
  const scorePercent = maxPoints > 0 ? Math.round((scorePoints / maxPoints) * 10000) / 100 : 0;
  const row = await prisma.training_assessment_attempts.update({
    where: { id: attemptId },
    data: {
      score: scorePercent,
      status: 'GRADED',
      graded_at: new Date(),
      answers_json: {
        ...(attempt.answers_json || {}),
        gradingDetails: merged,
        maxScore: maxPoints,
        scorePercent,
        feedback: body.feedback || null,
      },
      updated_at: new Date(),
    },
  });

  await emitDomainEvent(
    attempt.training_assessments.kind === 'PRE_TEST' ? 'PRE_TEST_GRADED' : 'POST_TEST_GRADED',
    {
      organizationId: attempt.training_assessments.training_programs.organization_id,
      affectedUserId: attempt.user_id,
      entityType: 'training_assessment_attempt',
      entityId: row.id,
    }
  ).catch(() => null);

  const { recomputeProgress } = require('./trainingPrograms.service');
  await recomputeProgress(requester, attempt.enrollment_id).catch(() => null);

  if (attempt.training_assessments.kind === 'POST_TEST') {
    try {
      const evaluation = require('./trainingEvaluation.service');
      await evaluation.unlockEvaluationAfterPostTest(attempt.enrollment_id, { pendingManual: false });
    } catch {
      /* evaluation unlock is best-effort */
    }
  }

  return mapAttempt(row);
}

async function listAssessmentResults(requester, assessmentId) {
  const assessment = await prisma.training_assessments.findUnique({
    where: { id: assessmentId },
    include: { training_programs: true },
  });
  if (!assessment || assessment.training_programs.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الاختبار غير موجود', null, 'ASSESSMENT_NOT_FOUND');
  }
  assertOrganizationAccess(requester, assessment.training_programs.organization_id);
  if (isTrainerOnly(requester)) {
    const { listTrainerAssignmentsForProgram, mergeAssignmentPermissionFlags } = require('./trainerScope');
    const rows = await listTrainerAssignmentsForProgram(requester.userId, assessment.program_id);
    if (!rows.length) {
      throw new ApiError(403, 'لا تملك تعيينًا نشطًا لهذه الدورة التدريبية.', null, 'TRAINER_ASSIGNMENT_REQUIRED');
    }
    const { permissions } = mergeAssignmentPermissionFlags(rows);
    if (!permissions.can_manage_assessments && !permissions.can_grade_assessments) {
      throw new ApiError(403, 'لا تملك صلاحية المدرب المطلوبة لهذا الإجراء.', null, 'TRAINER_PERMISSION_REQUIRED');
    }
  }

  const rows = await prisma.training_assessment_attempts.findMany({
    where: {
      assessment_id: assessmentId,
      status: { in: ['SUBMITTED', 'GRADED', 'IN_PROGRESS', 'EXPIRED'] },
    },
    orderBy: [{ submitted_at: 'desc' }, { created_at: 'desc' }],
  });
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const users = userIds.length
    ? await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const byUser = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    ...mapAttempt(r),
    traineeName: byUser.get(r.user_id)?.full_name || '—',
    traineeEmail: byUser.get(r.user_id)?.email || null,
    pendingManual: r.status === 'SUBMITTED',
  }));
}

async function getPrePostComparison(requester, programId) {
  const program = await loadProgram(programId);
  assertOrganizationAccess(requester, program.organization_id);
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, programId, 'can_view_progress');
  }

  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: programId, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
  });
  const pre = assessments.find((a) => a.kind === 'PRE_TEST');
  const post = assessments.find((a) => a.kind === 'POST_TEST');
  if (!pre && !post) return { items: [] };

  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      organization_id: program.organization_id,
      training_cohorts: { program_id: programId },
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
      ...(requester.roles?.includes('trainee') && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')
        ? { user_id: requester.userId }
        : {}),
    },
  });

  const items = [];
  for (const en of enrollments) {
    const preAttempt = pre
      ? await prisma.training_assessment_attempts.findFirst({
          where: {
            assessment_id: pre.id,
            enrollment_id: en.id,
            status: { in: ['GRADED', 'SUBMITTED'] },
          },
          orderBy: { attempt_no: 'desc' },
        })
      : null;
    const postAttempt = post
      ? await prisma.training_assessment_attempts.findFirst({
          where: {
            assessment_id: post.id,
            enrollment_id: en.id,
            status: { in: ['GRADED', 'SUBMITTED'] },
          },
          orderBy: { attempt_no: 'desc' },
        })
      : null;
    const preScore = preAttempt?.score != null ? Number(preAttempt.score) : null;
    const postScore = postAttempt?.score != null ? Number(postAttempt.score) : null;
    const diff = preScore != null && postScore != null ? postScore - preScore : null;
    const improvementPct =
      preScore != null && postScore != null && preScore > 0
        ? Math.round(((postScore - preScore) / preScore) * 10000) / 100
        : null;
    const user = await prisma.users.findUnique({
      where: { id: en.user_id },
      select: { id: true, full_name: true, email: true },
    });
    items.push({
      enrollmentId: en.id,
      userId: en.user_id,
      traineeName: user?.full_name || '—',
      preScore,
      postScore,
      difference: diff,
      improvementPct,
      prePassed: pre?.pass_score != null && preScore != null ? preScore >= Number(pre.pass_score) : null,
      postPassed:
        post?.pass_score != null && postScore != null ? postScore >= Number(post.pass_score) : null,
    });
  }
  return { programId, items };
}

async function getTraineeAssessmentStatus(requester, programId) {
  const program = await loadProgram(programId);
  assertOrganizationAccess(requester, program.organization_id);
  const enrollment = await findEnrollmentForProgram(
    requester.userId,
    programId,
    program.organization_id
  );
  if (!enrollment) {
    throw new ApiError(403, 'يلزم التسجيل في الدورة', null, 'COURSE_ENROLLMENT_REQUIRED');
  }
  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: programId, is_published: true },
    include: { _count: { select: { training_assessment_questions: true } } },
  });
  const result = [];
  for (const a of assessments) {
    const attempts = await prisma.training_assessment_attempts.findMany({
      where: { assessment_id: a.id, enrollment_id: enrollment.id },
      orderBy: { attempt_no: 'asc' },
    });
    let availability = 'available';
    let availabilityMessage = null;
    try {
      await assertAvailability(a);
      if (a.kind === 'POST_TEST') {
        await assertPostTestEligible(requester, a, enrollment);
      }
    } catch (err) {
      availability = 'locked';
      availabilityMessage = err.message;
      if (err.code) availability = err.code;
    }
    const used = attempts.filter((x) => ['SUBMITTED', 'GRADED', 'EXPIRED'].includes(x.status)).length;
    const active = attempts.find((x) => x.status === 'IN_PROGRESS');
    const latest = [...attempts].reverse().find((x) => ['SUBMITTED', 'GRADED'].includes(x.status));
    result.push({
      ...mapAssessmentOut(a),
      questionCount: a._count.training_assessment_questions,
      availability,
      availabilityMessage,
      attemptsUsed: used,
      attemptsAllowed: a.max_attempts,
      activeAttemptId: active?.id || null,
      latestResult:
        latest && a.show_results
          ? {
              score: latest.score != null ? Number(latest.score) : null,
              status: latest.status,
              submittedAt: latest.submitted_at,
              pendingManual: latest.status === 'SUBMITTED',
            }
          : latest
            ? { status: latest.status, pendingManual: latest.status === 'SUBMITTED' }
            : null,
    });
  }
  return { enrollmentId: enrollment.id, assessments: result };
}

module.exports = {
  listProgramAssessments,
  getAssessment,
  upsertAssessment,
  publishAssessment,
  startAttempt,
  saveAttemptAnswers,
  submitAttempt,
  submitAssessment,
  gradeAttempt,
  listAssessmentResults,
  getPrePostComparison,
  getTraineeAssessmentStatus,
  mapAssessmentOut,
};
