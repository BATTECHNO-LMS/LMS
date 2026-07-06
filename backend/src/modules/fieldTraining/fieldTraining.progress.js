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
    post_assessment_completed: order.post_assessment,
    eligible_for_completion: order.completion_letter,
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
 * @param {{ sessionsCount?: number, tasksCount?: number, tasksSubmitted?: number }} [counts]
 */
function buildParticipantProgress(app, opp, counts = {}) {
  const order = Object.fromEntries(STEP_ORDER.map((s, i) => [s, i]));
  const currentIdx = resolveStepIndex(app.training_status, app.status);

  const steps = STEP_ORDER.map((key) => ({
    key,
    status: stepStatus(currentIdx, key, order),
  }));

  return {
    application: repo.mapApplicationRow(app),
    opportunity: {
      id: opp.id,
      title: opp.title,
      status: opp.status,
      requires_pre_assessment: opp.requires_pre_assessment,
      requires_post_assessment: opp.requires_post_assessment,
      requires_final_task: opp.requires_final_task,
    },
    steps,
    next_action: resolveNextAction(app, opp),
    metrics: {
      sessions_count: counts.sessionsCount ?? null,
      tasks_count: counts.tasksCount ?? null,
      tasks_submitted: counts.tasksSubmitted ?? null,
      attendance_percentage:
        app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      pre_assessment_score: app.pre_assessment_score != null ? Number(app.pre_assessment_score) : null,
      pre_assessment_level: app.pre_assessment_level ?? null,
      post_assessment_score: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
      completion_eligibility_status: app.completion_eligibility_status ?? 'pending',
      completion_letter_issued_at: app.completion_letter_issued_at ?? null,
    },
  };
}

module.exports = {
  buildParticipantProgress,
  STEP_ORDER,
};
