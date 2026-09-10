'use strict';

/**
 * Presentation-only Field Training task semantics (P2).
 *
 * Concepts stay separate:
 *   A. Submission state  — does a real LMS submission row exist?
 *   B. Evaluation state  — has the submission been finally reviewed?
 *   C. Score             — approved/reviewed grade for display
 *   D. Timing            — on time vs late (never a submission status)
 *
 * Does not change scoring, eligibility, or LMS rows.
 */

const EVALUATION_COMPLETE_STATUSES = Object.freeze(['graded', 'approved']);
const RETURNED_STATUSES = Object.freeze(['needs_revision', 'rejected']);
const IN_REVIEW_STATUSES = Object.freeze(['pending', 'submitted', 'under_review']);

const SUBMISSION_STATE = Object.freeze({
  NOT_SUBMITTED: 'not_submitted',
  SUBMITTED: 'submitted',
});

const EVALUATION_STATE = Object.freeze({
  NOT_EVALUATED: 'not_evaluated',
  IN_REVIEW: 'in_review',
  EVALUATED: 'evaluated',
  RETURNED: 'returned',
});

const TIMING_STATE = Object.freeze({
  ON_TIME: 'on_time',
  LATE: 'late',
});

const SUBMISSION_LABEL_AR = Object.freeze({
  not_submitted: 'غير مسلّم',
  submitted: 'مسلّم',
});

const EVALUATION_LABEL_AR = Object.freeze({
  not_evaluated: 'لم يتم التقييم',
  in_review: 'قيد التقييم',
  evaluated: 'تم التقييم',
  returned: 'تحتاج إعادة تسليم',
});

const TIMING_LABEL_AR = Object.freeze({
  on_time: 'في الوقت',
  late: 'متأخر',
});

const EMPTY_GRADE_AR = 'لا توجد';
const EMPTY_DATE_AR = 'لا يوجد';

function hasRealSubmission(submission) {
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

function resolveEvaluationState(reviewStatus) {
  if (!reviewStatus) return EVALUATION_STATE.NOT_EVALUATED;
  if (EVALUATION_COMPLETE_STATUSES.includes(reviewStatus)) return EVALUATION_STATE.EVALUATED;
  if (RETURNED_STATUSES.includes(reviewStatus)) return EVALUATION_STATE.RETURNED;
  if (IN_REVIEW_STATUSES.includes(reviewStatus)) return EVALUATION_STATE.IN_REVIEW;
  return EVALUATION_STATE.IN_REVIEW;
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = Number(value.toNumber());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function displayGrade({ submitted, evaluationState, submission, overlayScore } = {}) {
  if (!submitted) return { score: null, maxScore: null, labelAr: EMPTY_GRADE_AR };
  const max = toFiniteNumber(submission?.max_score) ?? 100;
  if (evaluationState === EVALUATION_STATE.EVALUATED) {
    const scored = toFiniteNumber(submission?.manual_score);
    if (scored != null) {
      return { score: scored, maxScore: max, labelAr: null };
    }
    const overlay = toFiniteNumber(overlayScore);
    if (overlay != null) {
      return { score: overlay, maxScore: max, labelAr: null };
    }
  }
  return { score: null, maxScore: max, labelAr: EMPTY_GRADE_AR };
}

/**
 * @param {{
 *   task?: object,
 *   submission?: object|null,
 *   overlayScore?: number|null,
 * }} input
 */
function resolveTaskPresentation({ task = null, submission = null, overlayScore = null } = {}) {
  const submitted = hasRealSubmission(submission);
  const reviewStatus = normalizeReviewStatus(submission);
  const evaluationState = submitted
    ? resolveEvaluationState(reviewStatus)
    : EVALUATION_STATE.NOT_EVALUATED;
  const evaluated = evaluationState === EVALUATION_STATE.EVALUATED;
  const completed = submitted && evaluated;
  const isLate = submitted ? Boolean(submission.is_late) : false;
  const grade = displayGrade({ submitted, evaluationState, submission, overlayScore });

  let overallState;
  let overallLabelAr;
  if (!submitted) {
    overallState = 'not_submitted';
    overallLabelAr = SUBMISSION_LABEL_AR.not_submitted;
  } else if (evaluated) {
    overallState = 'completed';
    overallLabelAr = 'مكتمل';
  } else if (evaluationState === EVALUATION_STATE.RETURNED) {
    overallState = 'returned';
    overallLabelAr = EVALUATION_LABEL_AR.returned;
  } else {
    overallState = 'in_review';
    overallLabelAr = EVALUATION_LABEL_AR.in_review;
  }

  return {
    taskId: task?.id || task?.taskId || null,
    title: task?.title || null,
    submitted,
    submissionState: submitted ? SUBMISSION_STATE.SUBMITTED : SUBMISSION_STATE.NOT_SUBMITTED,
    submissionLabelAr: submitted ? SUBMISSION_LABEL_AR.submitted : SUBMISSION_LABEL_AR.not_submitted,
    evaluationState,
    evaluationLabelAr: EVALUATION_LABEL_AR[evaluationState],
    completed,
    overallState,
    overallLabelAr,
    reviewStatus,
    score: grade.score,
    maxScore: grade.maxScore,
    scoreLabelAr: grade.labelAr,
    isLate,
    timingState: submitted ? (isLate ? TIMING_STATE.LATE : TIMING_STATE.ON_TIME) : null,
    timingLabelAr: submitted ? (isLate ? TIMING_LABEL_AR.late : TIMING_LABEL_AR.on_time) : null,
    submittedAt: submitted ? submission.submitted_at || null : null,
    submittedAtLabelAr: submitted ? null : EMPTY_DATE_AR,
  };
}

function presentOpportunityTasks(tasks = [], submissions = []) {
  const byTask = new Map();
  for (const sub of submissions || []) {
    const id = String(sub.task_id || sub.taskId || '');
    if (id && !byTask.has(id)) byTask.set(id, sub);
  }
  const list =
    (tasks || []).length > 0
      ? tasks
      : (submissions || []).map((row) => ({
          id: row.task_id,
          title: row.task_title,
        }));
  return list.map((task) => {
    const submission = byTask.get(String(task.id || task.taskId || '')) || null;
    const presented = resolveTaskPresentation({ task, submission });
    return {
      ...presented,
      taskTitle: presented.title || task.title || null,
    };
  });
}

function countOfAr(done, total) {
  if (done == null || total == null) return 'غير متوفر';
  return `${Number(done)} من ${Number(total)}`;
}

function scoreTextAr(earned, max, empty = EMPTY_GRADE_AR) {
  if (earned == null || earned === '') return empty;
  if (max == null || max === '') return String(earned);
  return `${earned} / ${max}`;
}

module.exports = {
  EVALUATION_COMPLETE_STATUSES,
  RETURNED_STATUSES,
  IN_REVIEW_STATUSES,
  SUBMISSION_STATE,
  EVALUATION_STATE,
  TIMING_STATE,
  SUBMISSION_LABEL_AR,
  EVALUATION_LABEL_AR,
  TIMING_LABEL_AR,
  EMPTY_GRADE_AR,
  EMPTY_DATE_AR,
  hasRealSubmission,
  resolveEvaluationState,
  resolveTaskPresentation,
  countOfAr,
  scoreTextAr,
  presentOpportunityTasks,
};
