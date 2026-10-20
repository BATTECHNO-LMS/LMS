'use strict';

/**
 * Deterministic readiness / next-action helpers for Field Training.
 * Score math stays in qualification; this layer only interprets public DTOs.
 */

const READINESS_STATES = Object.freeze({
  NOT_READY: 'NOT_READY',
  NEARLY_READY: 'NEARLY_READY',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
});

const READINESS_REASONS = Object.freeze({
  SCORE_BELOW_THRESHOLD: 'SCORE_BELOW_THRESHOLD',
  HOURS_INCOMPLETE: 'HOURS_INCOMPLETE',
  POST_NOT_COMPLETED: 'POST_NOT_COMPLETED',
  PRE_NOT_COMPLETED: 'PRE_NOT_COMPLETED',
  TASKS_PENDING: 'TASKS_PENDING',
  BEHAVIOR_PENDING: 'BEHAVIOR_PENDING',
  ATTENDANCE_INCOMPLETE: 'ATTENDANCE_INCOMPLETE',
  APPLICATION_NOT_ACTIVE: 'APPLICATION_NOT_ACTIVE',
  TRAINING_NOT_STARTED: 'TRAINING_NOT_STARTED',
  LETTER_PENDING: 'LETTER_PENDING',
  EXPELLED: 'EXPELLED',
  FAILED: 'FAILED',
});

const REASON_LABELS_AR = Object.freeze({
  SCORE_BELOW_THRESHOLD: 'الدرجة الحالية أقل من الحد المطلوب',
  HOURS_INCOMPLETE: 'الساعات التدريبية غير مكتملة',
  POST_NOT_COMPLETED: 'يتبقى عليك إكمال الاختبار البعدي (POST Assessment)',
  PRE_NOT_COMPLETED: 'يتبقى عليك إكمال التقييم القبلي (PRE Assessment)',
  TASKS_PENDING: 'ما زال لديك مهام غير مكتملة أو بحاجة إلى التقييم',
  BEHAVIOR_PENDING: 'بانتظار التقييم السلوكي / تقييم المشرف',
  ATTENDANCE_INCOMPLETE: 'نسبة الحضور أو الجلسات المطلوبة غير مكتملة',
  APPLICATION_NOT_ACTIVE: 'الطلب غير معتمد أو غير نشط',
  TRAINING_NOT_STARTED: 'لم يبدأ التدريب بعد',
  LETTER_PENDING: 'أنت مستوفٍ للمتطلبات وبانتظار إصدار كتاب الإكمال',
  EXPELLED: 'تم استبعاد الطالب من التدريب',
  FAILED: 'حالة التدريب: لم يجتز',
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function componentPoints(components, key, fallbackMax) {
  const row = components?.[key] || {};
  return {
    points: row.points != null ? num(row.points) : null,
    max: row.maxPoints != null ? num(row.maxPoints) : fallbackMax,
  };
}

/**
 * @param {{
 *   application?: object,
 *   opportunity?: object,
 *   qualification?: object|null,
 *   hours?: object|null,
 *   progressMetrics?: object|null,
 * }} input
 */
function resolveFieldTrainingReadiness(input = {}) {
  const app = input.application || {};
  const opp = input.opportunity || {};
  const qualification = input.qualification || null;
  const hours = input.hours || {};
  const metrics = input.progressMetrics || {};
  const reasons = [];
  const components = qualification?.scoreComponents || {};

  if (app.status && app.status !== 'approved') {
    reasons.push(READINESS_REASONS.APPLICATION_NOT_ACTIVE);
  }
  if (app.training_status === 'expelled') {
    reasons.push(READINESS_REASONS.EXPELLED);
  }
  if (app.training_status === 'failed') {
    reasons.push(READINESS_REASONS.FAILED);
  }
  if (
    ['none', 'pre_assessment_pending', 'pre_assessment_completed', 'ready_for_training'].includes(
      app.training_status
    ) &&
    app.status === 'approved'
  ) {
    if (!['in_training', 'task_pending', 'task_submitted', 'post_assessment_pending', 'post_assessment_completed', 'eligible_for_completion', 'completed'].includes(app.training_status)) {
      if (app.training_status !== 'pre_assessment_pending') {
        reasons.push(READINESS_REASONS.TRAINING_NOT_STARTED);
      }
    }
  }

  if (Boolean(opp.requires_pre_assessment) && metrics.pre_assessment_score == null && app.pre_assessment_score == null) {
    reasons.push(READINESS_REASONS.PRE_NOT_COMPLETED);
  }
  if (Boolean(opp.requires_post_assessment) && metrics.post_assessment_score == null && app.post_assessment_score == null) {
    reasons.push(READINESS_REASONS.POST_NOT_COMPLETED);
  }

  const eligibilityStatus =
    qualification?.eligibilityStatus ||
    qualification?.workflowOutcome ||
    app.completion_eligibility_status ||
    null;
  const scorePassed = Boolean(qualification?.scorePassed);
  const finalScore = num(qualification?.finalScore);
  const passingScore = num(qualification?.passingScore) ?? 80;

  if (qualification && finalScore != null && !scorePassed) {
    reasons.push(READINESS_REASONS.SCORE_BELOW_THRESHOLD);
  }

  const hoursStatus = hours.hours_completion_status || metrics.hours_completion_status;
  const requiredHours = num(hours.required_training_hours ?? metrics.required_training_hours);
  const completedHours = num(hours.completed_training_hours ?? metrics.completed_training_hours) ?? 0;
  if (requiredHours != null && requiredHours > 0) {
    if (hoursStatus !== 'complete' && completedHours < requiredHours) {
      reasons.push(READINESS_REASONS.HOURS_INCOMPLETE);
    }
  }

  const eligibilityReasons = qualification?.eligibilityReasons || [];
  for (const code of eligibilityReasons) {
    if (String(code).includes('TASK') || String(code).includes('REQUIRED_TASK')) {
      if (!reasons.includes(READINESS_REASONS.TASKS_PENDING)) reasons.push(READINESS_REASONS.TASKS_PENDING);
    }
    if (String(code).includes('ATTENDANCE') || String(code).includes('ABSENCE')) {
      if (!reasons.includes(READINESS_REASONS.ATTENDANCE_INCOMPLETE)) {
        reasons.push(READINESS_REASONS.ATTENDANCE_INCOMPLETE);
      }
    }
    if (String(code).includes('BEHAVIOR') || String(code).includes('PROFESSIONAL') || String(code).includes('EVALUATION')) {
      if (!reasons.includes(READINESS_REASONS.BEHAVIOR_PENDING)) reasons.push(READINESS_REASONS.BEHAVIOR_PENDING);
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  const blocking = uniqueReasons.filter(
    (r) => ![READINESS_REASONS.LETTER_PENDING, READINESS_REASONS.TRAINING_NOT_STARTED].includes(r)
  );

  let state = READINESS_STATES.NOT_READY;
  const officiallyEligible =
    eligibilityStatus === 'ELIGIBLE' ||
    eligibilityStatus === 'eligible' ||
    app.completion_eligibility_status === 'eligible';

  if (app.training_status === 'completed' && app.completion_letter_issued_at) {
    state = READINESS_STATES.COMPLETED;
  } else if (officiallyEligible && !blocking.length) {
    if (!app.completion_letter_issued_at) {
      uniqueReasons.push(READINESS_REASONS.LETTER_PENDING);
      state = READINESS_STATES.READY;
    } else {
      state = READINESS_STATES.COMPLETED;
    }
  } else if (
    scorePassed &&
    blocking.length === 1 &&
    (blocking[0] === READINESS_REASONS.HOURS_INCOMPLETE ||
      blocking[0] === READINESS_REASONS.POST_NOT_COMPLETED ||
      blocking[0] === READINESS_REASONS.BEHAVIOR_PENDING ||
      blocking[0] === READINESS_REASONS.TASKS_PENDING)
  ) {
    state = READINESS_STATES.NEARLY_READY;
  } else if (officiallyEligible) {
    state = READINESS_STATES.READY;
  } else {
    state = READINESS_STATES.NOT_READY;
  }

  const remainingHours =
    requiredHours != null ? Math.max(0, Math.round((requiredHours - completedHours) * 100) / 100) : null;

  return {
    state,
    state_label_ar:
      state === READINESS_STATES.COMPLETED
        ? 'مكتمل'
        : state === READINESS_STATES.READY
          ? 'مستوفٍ للشروط'
          : state === READINESS_STATES.NEARLY_READY
            ? 'قريب من الاستيفاء'
            : 'غير مستوفٍ',
    reasons: uniqueReasons,
    reason_labels_ar: uniqueReasons.map((code) => REASON_LABELS_AR[code] || code),
    primary_reason: uniqueReasons[0] || null,
    explanation_ar: buildReadinessExplanation({
      state,
      reasons: uniqueReasons,
      remainingHours,
      finalScore,
      passingScore,
    }),
    score: {
      final: finalScore,
      passing: passingScore,
      passed: scorePassed,
      components: {
        attendance: componentPoints(components, 'attendance', 20),
        postAssessment: componentPoints(components, 'postAssessment', 20),
        tasks: componentPoints(components, 'tasks', 40),
        behavior: componentPoints(components, 'behavior', 20),
      },
    },
    completion_requirements: {
      hours: {
        required: requiredHours,
        completed: completedHours,
        remaining: remainingHours,
        status: hoursStatus || null,
        unit: 'hours',
      },
      pre: {
        required: Boolean(opp.requires_pre_assessment),
        completed:
          !opp.requires_pre_assessment ||
          metrics.pre_assessment_score != null ||
          app.pre_assessment_score != null,
        scored: false,
      },
      post: {
        required: Boolean(opp.requires_post_assessment),
        completed:
          !opp.requires_post_assessment ||
          metrics.post_assessment_score != null ||
          app.post_assessment_score != null,
      },
    },
    eligibility_status: eligibilityStatus,
  };
}

function buildReadinessExplanation({ state, reasons, remainingHours, finalScore, passingScore }) {
  if (state === READINESS_STATES.COMPLETED) {
    return 'اكتمل التدريب وتم استيفاء جميع المتطلبات.';
  }
  if (state === READINESS_STATES.READY) {
    if (reasons.includes(READINESS_REASONS.LETTER_PENDING)) {
      return 'أنت مستوفٍ لجميع متطلبات إكمال التدريب وبانتظار إصدار كتاب الإكمال.';
    }
    return 'أنت مستوفٍ لجميع متطلبات إكمال التدريب.';
  }
  if (reasons.includes(READINESS_REASONS.HOURS_INCOMPLETE) && remainingHours != null) {
    if (finalScore != null && passingScore != null && finalScore >= passingScore) {
      return `درجتك الحالية مستوفية للحد المطلوب، ويتبقى لك ${remainingHours} ساعة تدريب لإكمال المتطلبات.`;
    }
    return `يتبقى لك ${remainingHours} ساعة تدريب لإكمال متطلب الساعات.`;
  }
  if (reasons.includes(READINESS_REASONS.POST_NOT_COMPLETED)) {
    return REASON_LABELS_AR.POST_NOT_COMPLETED;
  }
  if (reasons.includes(READINESS_REASONS.PRE_NOT_COMPLETED)) {
    return REASON_LABELS_AR.PRE_NOT_COMPLETED;
  }
  if (reasons.includes(READINESS_REASONS.TASKS_PENDING)) {
    return REASON_LABELS_AR.TASKS_PENDING;
  }
  if (reasons.includes(READINESS_REASONS.BEHAVIOR_PENDING)) {
    return REASON_LABELS_AR.BEHAVIOR_PENDING;
  }
  if (reasons.includes(READINESS_REASONS.SCORE_BELOW_THRESHOLD)) {
    return `الدرجة الحالية ${finalScore ?? '—'} / 100 أقل من الحد المطلوب ${passingScore}.`;
  }
  if (reasons[0] && REASON_LABELS_AR[reasons[0]]) return REASON_LABELS_AR[reasons[0]];
  return 'ما زالت هناك متطلبات غير مستوفاة لإكمال التدريب.';
}

/**
 * Deterministic next action from readiness + existing progress next_action.
 */
function resolveStudentNextAction({ readiness, progressNextAction, lectures = [], overdueTasks = [] } = {}) {
  const reasons = readiness?.reasons || [];
  if (reasons.includes(READINESS_REASONS.EXPELLED)) {
    return { key: 'expelled', label_ar: 'مستبعد من التدريب', href: null };
  }
  if (reasons.includes(READINESS_REASONS.FAILED)) {
    return { key: 'failed', label_ar: 'التدريب غير مكتمل', href: null };
  }
  if (readiness?.state === READINESS_STATES.COMPLETED) {
    return { key: 'completed', label_ar: 'اكتمل التدريب', href: 'completion' };
  }
  if (reasons.includes(READINESS_REASONS.LETTER_PENDING) || readiness?.state === READINESS_STATES.READY) {
    return { key: 'await_completion_letter', label_ar: 'بانتظار إصدار كتاب الإكمال', href: 'completion' };
  }
  if (reasons.includes(READINESS_REASONS.PRE_NOT_COMPLETED)) {
    return { key: 'complete_pre_assessment', label_ar: 'أكمل التقييم القبلي', href: 'assessments' };
  }
  if (reasons.includes(READINESS_REASONS.POST_NOT_COMPLETED)) {
    return { key: 'complete_post_assessment', label_ar: 'أكمل POST Assessment', href: 'assessments' };
  }
  if (overdueTasks.length) {
    return {
      key: 'submit_overdue_task',
      label_ar: overdueTasks.length === 1 ? 'سلّم المهمة المتأخرة' : `سلّم ${overdueTasks.length} مهام متأخرة`,
      href: 'tasks',
    };
  }
  if (reasons.includes(READINESS_REASONS.TASKS_PENDING)) {
    return { key: 'continue_tasks', label_ar: 'أكمل المهام المطلوبة', href: 'tasks' };
  }
  if (reasons.includes(READINESS_REASONS.HOURS_INCOMPLETE)) {
    const remaining = readiness?.completion_requirements?.hours?.remaining;
    return {
      key: 'complete_hours',
      label_ar: remaining != null ? `تبقى لك ${remaining} ساعات` : 'استكمل الساعات المطلوبة',
      href: 'overview',
    };
  }
  if (reasons.includes(READINESS_REASONS.BEHAVIOR_PENDING)) {
    return { key: 'await_behavior', label_ar: 'بانتظار تقييم المشرف', href: 'eligibility' };
  }
  const notStartedLecture = lectures.find((l) => (l.progress_percent || 0) <= 0 && !l.completed_at);
  if (notStartedLecture) {
    return {
      key: 'start_recorded_lecture',
      label_ar: 'أكمل المحاضرة المسجلة',
      href: 'recorded_lectures',
      lecture_id: notStartedLecture.id,
    };
  }
  const incompleteLecture = lectures.find(
    (l) => !l.completed_at && (l.progress_percent || 0) > 0 && (l.progress_percent || 0) < 100
  );
  if (incompleteLecture) {
    return {
      key: 'continue_recorded_lecture',
      label_ar: `أكمل المحاضرة المسجلة (${Math.round(incompleteLecture.progress_percent)}%)`,
      href: 'recorded_lectures',
      lecture_id: incompleteLecture.id,
    };
  }
  if (progressNextAction?.key) {
    return {
      key: progressNextAction.key,
      label_ar: progressNextAction.label_ar,
      href: mapProgressActionHref(progressNextAction.key),
    };
  }
  return { key: 'continue_training', label_ar: 'تابع التدريب', href: 'overview' };
}

function mapProgressActionHref(key) {
  if (key === 'complete_pre_assessment' || key === 'complete_post_assessment') return 'assessments';
  if (key === 'await_completion_letter' || key === 'completed') return 'completion';
  if (key === 'continue_training') return 'sessions';
  return 'overview';
}

module.exports = {
  READINESS_STATES,
  READINESS_REASONS,
  REASON_LABELS_AR,
  resolveFieldTrainingReadiness,
  resolveStudentNextAction,
  buildReadinessExplanation,
};
