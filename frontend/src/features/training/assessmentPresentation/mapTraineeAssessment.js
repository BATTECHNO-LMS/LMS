import { formatAssessmentDateTime } from './assessmentDate.js';

/**
 * Normalize inconsistent Backend field names for trainee assessment presentation.
 * Single adapter — do not re-implement fallbacks in UI components.
 *
 * @param {Record<string, unknown>} raw
 * @param {{ courseTitle?: string | null, programType?: string | null }} [context]
 */
export function mapTraineeAssessment(raw, context = {}) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const passScore =
    raw.passScore != null
      ? Number(raw.passScore)
      : raw.passingScore != null
        ? Number(raw.passingScore)
        : null;

  const attemptsAllowed =
    raw.attemptsAllowed != null
      ? Number(raw.attemptsAllowed)
      : raw.maxAttempts != null
        ? Number(raw.maxAttempts)
        : raw.maximumAttempts != null
          ? Number(raw.maximumAttempts)
          : null;

  const attemptsUsed = raw.attemptsUsed != null ? Number(raw.attemptsUsed) : 0;
  const durationMinutes = raw.durationMinutes != null ? Number(raw.durationMinutes) : null;
  const questionCount = raw.questionCount != null ? Number(raw.questionCount) : null;

  const kind = raw.kind || (raw.assessmentType === 'pre' || raw.type === 'pre' ? 'PRE_TEST' : raw.kind);
  const typeBadgeLabel = kind === 'POST_TEST' || raw.type === 'post' ? 'اختبار بعدي' : 'اختبار قبلي';

  const latestResult = raw.latestResult || raw.latestAttempt || null;
  const score =
    latestResult?.score != null
      ? Number(latestResult.score)
      : raw.latestScore != null
        ? Number(raw.latestScore)
        : null;

  const pendingManual = Boolean(
    latestResult?.pendingManual || raw.manualGradingPending || latestResult?.status === 'SUBMITTED'
  );

  const showResults = raw.showResults !== false && raw.showResult !== false;
  const showCorrectAnswers = Boolean(raw.showCorrectAnswers);

  const passedFromApi = typeof raw.passed === 'boolean' ? raw.passed : null;
  const passed =
    passedFromApi != null
      ? passedFromApi
      : score != null && passScore != null && !Number.isNaN(score) && !Number.isNaN(passScore)
        ? score >= passScore
        : null;

  const opensAt = raw.opensAt ?? raw.availableFrom ?? null;
  const closesAt = raw.closesAt ?? raw.availableUntil ?? null;

  const availability = raw.availability || raw.status || 'available';
  const activeAttemptId = raw.activeAttemptId || null;
  const canResume = Boolean(activeAttemptId);
  const exhausted =
    attemptsAllowed != null && !Number.isNaN(attemptsAllowed) && attemptsUsed >= attemptsAllowed && !canResume;

  const hasCompletedAttempt = Boolean(
    latestResult && ['SUBMITTED', 'GRADED', 'EXPIRED'].includes(String(latestResult.status || ''))
  );

  const uiState = resolveAssessmentUiState({
    availability,
    availabilityMessage: raw.availabilityMessage || null,
    canResume,
    exhausted,
    hasCompletedAttempt,
    pendingManual,
    opensAt,
  });

  const instructions = typeof raw.instructions === 'string' ? raw.instructions.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const bodyText = instructions || description || '';

  return {
    id: raw.id,
    title: raw.title || 'اختبار',
    kind: kind === 'POST_TEST' ? 'POST_TEST' : 'PRE_TEST',
    typeBadgeLabel,
    courseTitle: context.courseTitle || null,
    programType: context.programType || 'TRAINING_COURSE',
    durationMinutes: Number.isNaN(durationMinutes) ? null : durationMinutes,
    questionCount: Number.isNaN(questionCount) ? null : questionCount,
    attemptsUsed: Number.isNaN(attemptsUsed) ? 0 : attemptsUsed,
    attemptsAllowed: Number.isNaN(attemptsAllowed) ? null : attemptsAllowed,
    passScore: Number.isNaN(passScore) ? null : passScore,
    opensAt,
    closesAt,
    opensAtLabel: formatAssessmentDateTime(opensAt, { fallback: 'غير محدد' }),
    closesAtLabel: formatAssessmentDateTime(closesAt, { fallback: 'غير محدد' }),
    availability,
    availabilityMessage: raw.availabilityMessage || null,
    activeAttemptId,
    canResume,
    exhausted,
    hasCompletedAttempt,
    latestResult,
    score: showResults ? score : null,
    pendingManual,
    passed: showResults && !pendingManual ? passed : null,
    showResults,
    showCorrectAnswers,
    instructions: bodyText,
    description: bodyText,
    statusBadge: uiState.statusBadge,
    action: uiState.action,
    resultMode: uiState.resultMode,
  };
}

/**
 * Derive a single status badge + primary action + result card mode.
 * Does not change Backend availability/attempt rules — presentation only.
 */
export function resolveAssessmentUiState({
  availability,
  availabilityMessage,
  canResume,
  exhausted,
  hasCompletedAttempt,
  pendingManual,
  opensAt,
}) {
  let statusBadge = { key: 'available', label: 'متاح', variant: 'success' };

  if (pendingManual) {
    statusBadge = { key: 'pending', label: 'بانتظار التصحيح', variant: 'warning' };
  } else if (exhausted) {
    statusBadge = { key: 'completed', label: 'مكتمل', variant: 'info' };
  } else if (availability === 'ASSESSMENT_NOT_AVAILABLE') {
    statusBadge = { key: 'upcoming', label: 'قادم', variant: 'warning' };
  } else if (
    availability === 'ASSESSMENT_CLOSED' ||
    availability === 'ASSESSMENT_NOT_PUBLISHED'
  ) {
    statusBadge = { key: 'closed', label: 'مغلق', variant: 'danger' };
  } else if (
    availability === 'ASSESSMENT_PREREQUISITES_INCOMPLETE' ||
    (availability && availability !== 'available' && !hasCompletedAttempt && !canResume)
  ) {
    statusBadge = { key: 'closed', label: 'مغلق', variant: 'danger' };
  } else if (hasCompletedAttempt && !exhausted) {
    statusBadge = { key: 'available', label: 'متاح', variant: 'success' };
  } else {
    statusBadge = { key: 'available', label: 'متاح', variant: 'success' };
  }

  /** @type {{ type: string, label?: string, message?: string, opensAtLabel?: string }} */
  let action = { type: 'none' };

  if (canResume) {
    action = { type: 'resume', label: 'متابعة الاختبار' };
  } else if (availability === 'ASSESSMENT_NOT_AVAILABLE') {
    action = {
      type: 'not_open',
      message: 'لم يحن موعد الاختبار بعد',
      opensAtLabel: formatAssessmentDateTime(opensAt, { fallback: 'غير محدد' }),
    };
  } else if (availability === 'ASSESSMENT_CLOSED') {
    action = { type: 'closed', message: 'انتهت فترة إتاحة الاختبار' };
  } else if (
    availability === 'ASSESSMENT_PREREQUISITES_INCOMPLETE' ||
    (availability &&
      availability !== 'available' &&
      availability !== 'ASSESSMENT_NOT_AVAILABLE' &&
      availability !== 'ASSESSMENT_CLOSED' &&
      !hasCompletedAttempt)
  ) {
    action = {
      type: 'prerequisites',
      message:
        availabilityMessage || 'أكمل متطلبات الدورة المطلوبة لفتح هذا الاختبار',
    };
  } else if (exhausted) {
    action = { type: 'exhausted', message: 'أكملت جميع المحاولات المتاحة' };
  } else if (hasCompletedAttempt) {
    action = { type: 'retry', label: 'إعادة المحاولة' };
  } else if (availability === 'available' || !availability) {
    action = { type: 'start', label: 'بدء الاختبار' };
  } else {
    action = {
      type: 'prerequisites',
      message: availabilityMessage || 'الاختبار غير متاح حاليًا',
    };
  }

  let resultMode = 'none';
  if (pendingManual) {
    resultMode = 'pending';
  } else if (hasCompletedAttempt || exhausted) {
    resultMode = 'completed';
  }

  return { statusBadge, action, resultMode };
}

/**
 * Format metric display values from a mapped assessment (no invented defaults).
 */
export function buildAssessmentMetrics(mapped) {
  if (!mapped) return [];
  return [
    {
      key: 'duration',
      label: 'المدة',
      value:
        mapped.durationMinutes != null ? `${mapped.durationMinutes} دقيقة` : '—',
    },
    {
      key: 'questions',
      label: 'عدد الأسئلة',
      value:
        mapped.questionCount != null ? `${mapped.questionCount} سؤالًا` : '—',
    },
    {
      key: 'attempts',
      label: 'المحاولات',
      value:
        mapped.attemptsAllowed != null
          ? `${mapped.attemptsUsed} من ${mapped.attemptsAllowed}`
          : `${mapped.attemptsUsed}`,
    },
    {
      key: 'passScore',
      label: 'درجة النجاح',
      value: mapped.passScore != null ? `${mapped.passScore}%` : '—',
    },
  ];
}
