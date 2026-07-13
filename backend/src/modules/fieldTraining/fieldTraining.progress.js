const workflow = require('./fieldTraining.workflow');
const repo = require('./fieldTraining.repository');

const STEP_ORDER = [
  'application_submitted',
  'application_reviewed',
  'pre_assessment',
  'training_started',
  'sessions',
  'tasks',
  'post_assessment',
  'eligibility',
  'completion_letter',
];

function stepStatus(currentIdx, targetKey, order) {
  const targetIdx = order[targetKey];
  if (currentIdx > targetIdx) return 'completed';
  if (currentIdx === targetIdx) return 'current';
  return 'pending';
}

function resolveStepIndex(trainingStatus, appStatus) {
  const order = Object.fromEntries(STEP_ORDER.map((s, i) => [s, i]));
  if (appStatus === 'pending') return order.application_submitted;
  if (appStatus === 'rejected' || appStatus === 'cancelled') return order.application_reviewed;
  if (trainingStatus === 'expelled' || trainingStatus === 'failed') return order.application_reviewed;

  const map = {
    none: order.application_reviewed,
    pre_assessment_pending: order.pre_assessment,
    pre_assessment_completed: order.training_started,
    ready_for_training: order.training_started,
    in_training: order.sessions,
    task_pending: order.tasks,
    task_submitted: order.tasks,
    post_assessment_pending: order.post_assessment,
    post_assessment_completed: order.eligibility,
    eligible_for_completion: order.eligibility,
    completed: order.completion_letter,
  };
  return map[trainingStatus] ?? order.application_reviewed;
}

function resolveNextAction(app, opp) {
  if (app.status === 'pending') return { key: 'await_application_review', label_ar: 'انتظار مراجعة الطلب' };
  if (app.status === 'rejected') return { key: 'application_rejected', label_ar: 'تم رفض الطلب' };
  if (workflow.isExpelled(app)) return { key: 'expelled', label_ar: 'مستبعد من التدريب' };
  if (app.training_status === 'pre_assessment_pending' && opp.requires_pre_assessment) {
    return { key: 'complete_pre_assessment', label_ar: 'أكمل التقييم القبلي' };
  }
  if (['ready_for_training', 'pre_assessment_completed'].includes(app.training_status)) {
    return { key: 'await_training_start', label_ar: 'انتظار بدء التدريب' };
  }
  if (app.training_status === 'post_assessment_pending' && opp.requires_post_assessment) {
    return { key: 'complete_post_assessment', label_ar: 'أكمل التقييم البعدي' };
  }
  if (app.completion_eligibility_status === 'eligible' && !app.completion_letter_issued_at) {
    return { key: 'await_completion_letter', label_ar: 'بانتظار إصدار كتاب الإنهاء' };
  }
  if (app.training_status === 'completed') {
    return { key: 'completed', label_ar: 'اكتمل التدريب' };
  }
  return { key: 'continue_training', label_ar: 'تابع التدريب والمهام والجلسات' };
}

/**
 * @param {object} app - application row
 * @param {object} opp - opportunity row
 * @param {{
 *   sessionsCount?: number,
 *   requiredSessionsCount?: number,
 *   sessionsAttended?: number,
 *   attendanceRecordsCount?: number,
 *   tasksCount?: number,
 *   tasksSubmitted?: number,
 *   preAssessmentPublished?: boolean,
 *   postAssessmentPublished?: boolean,
 * }} [counts]
 */
function buildParticipantProgress(app, opp, counts = {}) {
  const order = Object.fromEntries(STEP_ORDER.map((s, i) => [s, i]));
  const currentIdx = resolveStepIndex(app.training_status, app.status);

  const steps = STEP_ORDER.map((key) => ({
    key,
    status: stepStatus(currentIdx, key, order),
  }));

  const preScore = app.pre_assessment_score != null ? Number(app.pre_assessment_score) : null;
  const postScore = app.post_assessment_score != null ? Number(app.post_assessment_score) : null;
  const minPost =
    opp.minimum_post_assessment_score != null ? Number(opp.minimum_post_assessment_score) : null;
  const postPassed =
    postScore == null ? null : minPost == null ? true : postScore >= minPost;

  return {
    application: repo.mapApplicationRow(app),
    opportunity: {
      id: opp.id,
      title: opp.title,
      status: opp.status,
      requires_pre_assessment: Boolean(opp.requires_pre_assessment),
      requires_post_assessment: Boolean(opp.requires_post_assessment),
      requires_final_task: Boolean(opp.requires_final_task),
      minimum_attendance_percentage:
        opp.minimum_attendance_percentage != null ? Number(opp.minimum_attendance_percentage) : null,
      minimum_post_assessment_score: minPost,
    },
    steps,
    next_action: resolveNextAction(app, opp),
    metrics: {
      sessions_count: counts.sessionsCount ?? 0,
      required_sessions_count: counts.requiredSessionsCount ?? 0,
      sessions_attended: counts.sessionsAttended ?? 0,
      attendance_records_count: counts.attendanceRecordsCount ?? 0,
      tasks_count: counts.tasksCount ?? 0,
      tasks_submitted: counts.tasksSubmitted ?? 0,
      // Aliases requested by overview contract
      total_tasks_count: counts.tasksCount ?? 0,
      submitted_tasks_count: counts.tasksSubmitted ?? 0,
      total_required_sessions: counts.requiredSessionsCount ?? 0,
      attended_sessions: counts.sessionsAttended ?? 0,
      attendance_percentage:
        app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      pre_assessment_required: Boolean(opp.requires_pre_assessment),
      pre_assessment_published: Boolean(counts.preAssessmentPublished),
      pre_assessment_score: preScore,
      pre_assessment_level: app.pre_assessment_level ?? null,
      post_assessment_required: Boolean(opp.requires_post_assessment),
      post_assessment_published: Boolean(counts.postAssessmentPublished),
      post_assessment_score: postScore,
      post_assessment_passed: postPassed,
      completion_eligibility_status: app.completion_eligibility_status ?? 'pending',
      completion_letter_issued_at: app.completion_letter_issued_at ?? null,
    },
  };
}

module.exports = {
  buildParticipantProgress,
  STEP_ORDER,
  resolveStepIndex,
};
