/**
 * Presentation-only Field Training task semantics (P2).
 * Mirrors backend/src/modules/fieldTraining/fieldTraining.taskSemantics.js
 * Does not change scoring or LMS rows.
 */

export const EVALUATION_COMPLETE_STATUSES = Object.freeze(['graded', 'approved']);
export const RETURNED_STATUSES = Object.freeze(['needs_revision', 'rejected']);
export const IN_REVIEW_STATUSES = Object.freeze(['pending', 'submitted', 'under_review']);

export const EMPTY_GRADE_AR = 'لا توجد';
export const EMPTY_DATE_AR = 'لا يوجد';
export const EMPTY_VALUE_AR = 'غير متوفر';

export function hasRealSubmission(submission) {
  if (!submission || typeof submission !== 'object') return false;
  if (submission.deleted_at || submission.archived_at) return false;
  if (submission.id == null && submission.review_status == null && submission.submitted_at == null) {
    return false;
  }
  return true;
}

function normalizeReviewStatus(submission) {
  if (!hasRealSubmission(submission)) return null;
  const raw = String(submission.review_status || submission.status || '').trim().toLowerCase();
  if (!raw || raw === 'missing' || raw === 'not_submitted') return 'pending';
  return raw;
}

export function resolveEvaluationState(reviewStatus) {
  if (!reviewStatus) return 'not_evaluated';
  if (EVALUATION_COMPLETE_STATUSES.includes(reviewStatus)) return 'evaluated';
  if (RETURNED_STATUSES.includes(reviewStatus)) return 'returned';
  if (IN_REVIEW_STATUSES.includes(reviewStatus)) return 'in_review';
  return 'in_review';
}

export function formatScore(earned, max, empty = EMPTY_GRADE_AR) {
  if (earned == null || earned === '') return empty;
  if (max == null || max === '') return String(earned);
  return `${earned} / ${max}`;
}

export function formatCountOf(done, total, empty = EMPTY_VALUE_AR) {
  if (done == null || total == null) return empty;
  return `${Number(done)} من ${Number(total)}`;
}

export function resolveTaskPresentation({ task = null, submission = null } = {}) {
  const submitted = hasRealSubmission(submission);
  const reviewStatus = normalizeReviewStatus(submission);
  const evaluationState = submitted ? resolveEvaluationState(reviewStatus) : 'not_evaluated';
  const evaluated = evaluationState === 'evaluated';
  const completed = submitted && evaluated;
  const isLate = submitted ? Boolean(submission.is_late) : false;
  const max =
    submission?.max_score != null && Number.isFinite(Number(submission.max_score))
      ? Number(submission.max_score)
      : 100;
  const score =
    evaluated && submission?.manual_score != null && Number.isFinite(Number(submission.manual_score))
      ? Number(submission.manual_score)
      : null;

  let overallState;
  let overallLabelAr;
  if (!submitted) {
    overallState = 'not_submitted';
    overallLabelAr = 'غير مسلّم';
  } else if (evaluated) {
    overallState = 'completed';
    overallLabelAr = 'مكتمل';
  } else if (evaluationState === 'returned') {
    overallState = 'returned';
    overallLabelAr = 'تحتاج إعادة تسليم';
  } else {
    overallState = 'in_review';
    overallLabelAr = 'قيد التقييم';
  }

  const evaluationLabelAr = {
    not_evaluated: 'لم يتم التقييم',
    in_review: 'قيد التقييم',
    evaluated: 'تم التقييم',
    returned: 'تحتاج إعادة تسليم',
  }[evaluationState];

  return {
    taskId: task?.id || task?.task_id || task?.taskId || null,
    title: task?.title || task?.task_title || null,
    submitted,
    submissionLabelAr: submitted ? 'مسلّم' : 'غير مسلّم',
    evaluationState,
    evaluationLabelAr,
    completed,
    overallState,
    overallLabelAr,
    reviewStatus,
    score,
    maxScore: submitted ? max : null,
    scoreLabelAr: score == null ? EMPTY_GRADE_AR : null,
    isLate,
    timingLabelAr: submitted ? (isLate ? 'متأخر' : 'في الوقت') : null,
    submittedAt: submitted ? submission.submitted_at || null : null,
  };
}
