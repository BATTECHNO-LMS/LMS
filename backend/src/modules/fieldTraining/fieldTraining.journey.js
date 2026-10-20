'use strict';

/**
 * Dynamic Field Training journey milestones from opportunity + student data.
 * Only includes milestones that exist for the opportunity.
 */

const JOURNEY_STATES = Object.freeze({
  COMPLETED: 'COMPLETED',
  CURRENT: 'CURRENT',
  UPCOMING: 'UPCOMING',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  BLOCKED: 'BLOCKED',
  OPTIONAL: 'OPTIONAL',
});

const STATE_LABELS_AR = Object.freeze({
  COMPLETED: 'مكتمل',
  CURRENT: 'قيد التنفيذ',
  UPCOMING: 'قادم',
  ACTION_REQUIRED: 'يتطلب إجراء',
  BLOCKED: 'متوقف مؤقتًا',
  OPTIONAL: 'اختياري',
});

function stateOf(completed, { current = false, actionRequired = false, blocked = false, optional = false } = {}) {
  if (completed) return JOURNEY_STATES.COMPLETED;
  if (blocked) return JOURNEY_STATES.BLOCKED;
  if (actionRequired) return JOURNEY_STATES.ACTION_REQUIRED;
  if (optional) return JOURNEY_STATES.OPTIONAL;
  if (current) return JOURNEY_STATES.CURRENT;
  return JOURNEY_STATES.UPCOMING;
}

function milestone(partial) {
  const state = partial.state || JOURNEY_STATES.UPCOMING;
  return {
    key: partial.key,
    title_ar: partial.title_ar,
    state,
    state_label_ar: STATE_LABELS_AR[state] || state,
    href: partial.href || null,
    detail_ar: partial.detail_ar || null,
    meta: partial.meta || null,
    optional: Boolean(partial.optional),
  };
}

/**
 * @param {{
 *   application?: object,
 *   opportunity?: object,
 *   progressMetrics?: object,
 *   hours?: object,
 *   taskProgress?: object|null,
 *   tasks?: Array<{id:string,title?:string,is_required?:boolean,due_date?:string|null,submitted?:boolean,overdue?:boolean}>,
 *   lectures?: Array<{id:string,title?:string,progress_percent?:number,completed_at?:string|null}>,
 *   sessions?: { count?: number, requiredCount?: number, attended?: number },
 *   readiness?: object,
 *   qualification?: object|null,
 * }} input
 */
function buildFieldTrainingJourney(input = {}) {
  const app = input.application || {};
  const opp = input.opportunity || {};
  const metrics = input.progressMetrics || {};
  const hours = input.hours || {};
  const lectures = input.lectures || [];
  const tasks = input.tasks || [];
  const readiness = input.readiness || {};
  const items = [];

  const appSubmitted = Boolean(app.id) || app.status === 'pending' || app.status === 'approved' || app.status === 'rejected';
  items.push(
    milestone({
      key: 'application_submitted',
      title_ar: 'تقديم طلب التدريب',
      state: stateOf(appSubmitted && app.status !== undefined),
      href: 'overview',
    })
  );

  const accepted = app.status === 'approved';
  const rejected = app.status === 'rejected';
  items.push(
    milestone({
      key: 'application_accepted',
      title_ar: rejected ? 'رفض الطلب' : 'قبول الطلب',
      state: rejected
        ? JOURNEY_STATES.BLOCKED
        : stateOf(accepted, { actionRequired: app.status === 'pending', current: app.status === 'pending' }),
      href: 'overview',
      detail_ar: rejected ? 'تم رفض الطلب' : app.status === 'pending' ? 'بانتظار المراجعة' : null,
    })
  );

  if (rejected || app.training_status === 'expelled') {
    return summarize(items, readiness);
  }

  const trainingStarted =
    Boolean(app.training_started_at) ||
    [
      'in_training',
      'task_pending',
      'task_submitted',
      'post_assessment_pending',
      'post_assessment_completed',
      'eligible_for_completion',
      'completed',
    ].includes(app.training_status);

  items.push(
    milestone({
      key: 'training_started',
      title_ar: 'بدء التدريب',
      state: stateOf(trainingStarted, {
        current: ['ready_for_training', 'pre_assessment_completed'].includes(app.training_status),
        actionRequired: app.training_status === 'ready_for_training',
      }),
      href: 'overview',
    })
  );

  if (opp.requires_pre_assessment) {
    const preDone = metrics.pre_assessment_score != null || app.pre_assessment_score != null;
    items.push(
      milestone({
        key: 'pre_assessment',
        title_ar: 'PRE Assessment',
        state: stateOf(preDone, {
          current: app.training_status === 'pre_assessment_pending',
          actionRequired: app.training_status === 'pre_assessment_pending' || !preDone,
        }),
        href: 'assessments',
        detail_ar: preDone ? 'مكتمل' : 'غير مكتمل',
        meta: { scored: false },
      })
    );
  }

  const sessionsCount = Number(input.sessions?.count ?? metrics.sessions_count ?? 0);
  const requiredSessions = Number(
    input.sessions?.requiredCount ?? metrics.required_sessions_count ?? 0
  );
  const attended = Number(input.sessions?.attended ?? metrics.sessions_attended ?? 0);
  if (sessionsCount > 0 || requiredSessions > 0) {
    const sessionsComplete =
      requiredSessions > 0 ? attended >= requiredSessions : attended > 0 && trainingStarted;
    items.push(
      milestone({
        key: 'attendance_sessions',
        title_ar:
          requiredSessions > 1 || sessionsCount > 1
            ? 'جلسات الحضور'
            : 'جلسة التدريب',
        state: stateOf(sessionsComplete, {
          current: app.training_status === 'in_training' && !sessionsComplete,
          actionRequired: trainingStarted && !sessionsComplete && attended < (requiredSessions || 1),
        }),
        href: 'attendance',
        detail_ar:
          requiredSessions > 0
            ? `${attended} / ${requiredSessions} جلسات`
            : attended > 0
              ? `${attended} جلسات`
              : null,
        meta: { attended, required: requiredSessions, total: sessionsCount },
      })
    );
  }

  for (const lecture of lectures) {
    const progress = Number(lecture.progress_percent || 0);
    const done = Boolean(lecture.completed_at) || progress >= 100;
    let detail_ar = 'لم يبدأ';
    if (done) detail_ar = 'مكتملة';
    else if (progress > 0) detail_ar = `${Math.round(progress)}%`;
    items.push(
      milestone({
        key: `recorded_lecture:${lecture.id}`,
        title_ar: lecture.title || 'المحاضرة المسجلة',
        state: stateOf(done, {
          current: !done && progress > 0,
          actionRequired: !done && trainingStarted,
        }),
        href: 'recorded_lectures',
        detail_ar,
        meta: {
          lecture_id: lecture.id,
          progress_percent: progress,
          completed: done,
        },
      })
    );
  }

  const requiredTasks = tasks.filter((t) => t.is_required !== false);
  const taskList = requiredTasks.length ? requiredTasks : tasks;
  if (taskList.length === 1) {
    const task = taskList[0];
    items.push(
      milestone({
        key: `task:${task.id}`,
        title_ar: task.title || 'المهمة',
        state: stateOf(Boolean(task.submitted), {
          actionRequired: Boolean(task.overdue) || (!task.submitted && trainingStarted),
          current: !task.submitted && app.training_status === 'task_pending',
        }),
        href: 'tasks',
        detail_ar: task.overdue ? 'متأخرة' : task.submitted ? 'مسلّمة' : null,
        meta: { task_id: task.id },
      })
    );
  } else if (taskList.length > 1) {
    taskList.forEach((task, index) => {
      items.push(
        milestone({
          key: `task:${task.id}`,
          title_ar: task.title || `المهمة ${index + 1}`,
          state: stateOf(Boolean(task.submitted), {
            actionRequired: Boolean(task.overdue) || (!task.submitted && trainingStarted),
            current: !task.submitted && app.training_status === 'task_pending',
          }),
          href: 'tasks',
          detail_ar: task.overdue ? 'متأخرة' : task.submitted ? 'مسلّمة' : null,
          meta: { task_id: task.id },
        })
      );
    });
  } else if (Number(input.taskProgress?.total_required ?? metrics.required_tasks_count ?? metrics.tasks_count ?? 0) > 0) {
    const submitted = Number(
      input.taskProgress?.submitted_required ?? metrics.submitted_required_tasks_count ?? metrics.tasks_submitted ?? 0
    );
    const total = Number(
      input.taskProgress?.total_required ?? metrics.required_tasks_count ?? metrics.tasks_count ?? 0
    );
    items.push(
      milestone({
        key: 'tasks',
        title_ar: 'المهام',
        state: stateOf(submitted >= total && total > 0, {
          current: app.training_status === 'task_pending',
          actionRequired: submitted < total && trainingStarted,
        }),
        href: 'tasks',
        detail_ar: `${submitted} / ${total}`,
      })
    );
  }

  if (opp.requires_post_assessment) {
    const postDone = metrics.post_assessment_score != null || app.post_assessment_score != null;
    items.push(
      milestone({
        key: 'post_assessment',
        title_ar: 'POST Assessment',
        state: stateOf(postDone, {
          current: app.training_status === 'post_assessment_pending',
          actionRequired: !postDone && trainingStarted,
        }),
        href: 'assessments',
        detail_ar: postDone ? 'مكتمل' : 'غير مكتمل',
      })
    );
  }

  const requiredHours = Number(
    hours.required_training_hours ?? metrics.required_training_hours ?? opp.required_training_hours
  );
  if (Number.isFinite(requiredHours) && requiredHours > 0) {
    const completedHours = Number(
      hours.completed_training_hours ?? metrics.completed_training_hours ?? app.completed_training_hours ?? 0
    );
    const hoursDone =
      hours.hours_completion_status === 'complete' || completedHours >= requiredHours;
    items.push(
      milestone({
        key: 'training_hours',
        title_ar: 'استكمال الساعات المطلوبة',
        state: stateOf(hoursDone, {
          current: trainingStarted && !hoursDone,
          actionRequired: trainingStarted && !hoursDone,
        }),
        href: 'overview',
        detail_ar: `${completedHours} / ${requiredHours} ساعة`,
        meta: { unit: 'hours', scored: false },
      })
    );
  }

  const behaviorDone =
    !(readiness.reasons || []).includes('BEHAVIOR_PENDING') &&
    (app.training_status === 'eligible_for_completion' ||
      app.training_status === 'completed' ||
      readiness.state === 'READY' ||
      readiness.state === 'COMPLETED' ||
      Boolean(input.qualification?.scoreComponents?.behavior?.points != null));
  const behaviorRelevant =
    (readiness.reasons || []).includes('BEHAVIOR_PENDING') ||
    input.qualification?.scoreComponents?.behavior != null ||
    ['post_assessment_completed', 'eligible_for_completion', 'completed'].includes(app.training_status);
  if (behaviorRelevant) {
    items.push(
      milestone({
        key: 'behavior_evaluation',
        title_ar: 'التقييم السلوكي',
        state: stateOf(behaviorDone && !(readiness.reasons || []).includes('BEHAVIOR_PENDING'), {
          actionRequired: (readiness.reasons || []).includes('BEHAVIOR_PENDING'),
          current: (readiness.reasons || []).includes('BEHAVIOR_PENDING'),
        }),
        href: 'eligibility',
        detail_ar: (readiness.reasons || []).includes('BEHAVIOR_PENDING')
          ? 'بانتظار التقييم'
          : behaviorDone
            ? 'مكتمل'
            : null,
      })
    );
  }

  const eligible =
    app.completion_eligibility_status === 'eligible' ||
    readiness.state === 'READY' ||
    readiness.state === 'COMPLETED';
  items.push(
    milestone({
      key: 'completion_requirements',
      title_ar: 'استيفاء شروط الإكمال',
      state: stateOf(eligible, {
        current: readiness.state === 'NEARLY_READY',
        actionRequired: readiness.state === 'NOT_READY' && trainingStarted,
        blocked: readiness.state === 'NOT_READY' && (readiness.reasons || []).length >= 2,
      }),
      href: 'eligibility',
      detail_ar: readiness.state_label_ar || null,
    })
  );

  const letterIssued = Boolean(app.completion_letter_issued_at);
  items.push(
    milestone({
      key: 'completion_letter',
      title_ar: 'إصدار كتاب الإكمال',
      state: stateOf(letterIssued, {
        current: eligible && !letterIssued,
        actionRequired: eligible && !letterIssued,
      }),
      href: 'completion',
      detail_ar: letterIssued ? 'تم الإصدار' : eligible ? 'بانتظار الإصدار' : null,
    })
  );

  return summarize(markCurrent(items), readiness);
}

function markCurrent(items) {
  const firstOpen = items.findIndex(
    (m) =>
      m.state === JOURNEY_STATES.ACTION_REQUIRED ||
      m.state === JOURNEY_STATES.CURRENT ||
      m.state === JOURNEY_STATES.UPCOMING ||
      m.state === JOURNEY_STATES.BLOCKED
  );
  if (firstOpen < 0) return items;
  return items.map((m, i) => {
    if (i !== firstOpen) return m;
    if (m.state === JOURNEY_STATES.UPCOMING) {
      return {
        ...m,
        state: JOURNEY_STATES.CURRENT,
        state_label_ar: STATE_LABELS_AR.CURRENT,
      };
    }
    return m;
  });
}

function summarize(items, readiness) {
  const countable = items.filter((m) => m.state !== JOURNEY_STATES.OPTIONAL);
  const completed = countable.filter((m) => m.state === JOURNEY_STATES.COMPLETED).length;
  return {
    title_ar: 'رحلة التدريب الميداني',
    completed_count: completed,
    total_count: countable.length,
    summary_ar: `${completed} من ${countable.length} مراحل مكتملة`,
    readiness_state: readiness?.state || null,
    milestones: items,
  };
}

module.exports = {
  JOURNEY_STATES,
  STATE_LABELS_AR,
  buildFieldTrainingJourney,
};
