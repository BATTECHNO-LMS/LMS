'use strict';

/**
 * Per-student required-task progress for a field-training opportunity.
 * Derived on read from tasks + submissions (no stored status column).
 */

const { prisma } = require('../../config/db');
const labels = require('./fieldTrainingReport.labels');

const TASK_PROGRESS_STATUS = Object.freeze({
  NO_REQUIRED_TASKS: 'no_required_tasks',
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
});

const TASK_PROGRESS_LABEL_AR = Object.freeze({
  no_required_tasks: 'لا توجد مهمات مطلوبة',
  not_started: 'لم يبدأ المهمات',
  in_progress: 'قيد إنجاز المهمات',
  completed: 'أكمل المهمات',
  cancelled: 'ملغى',
});

const TASK_PROGRESS_LABEL_EN = Object.freeze({
  no_required_tasks: 'No required tasks',
  not_started: 'Has not started tasks',
  in_progress: 'Tasks in progress',
  completed: 'Completed tasks',
  cancelled: 'Cancelled',
});

/**
 * Existing review_status values that mean the student has a valid non-draft submission.
 * `pending` is the AI grading workflow's post-submit state (labeled "قيد المراجعة"), not a draft.
 * Drafts are not persisted; `needs_revision` / `rejected` do not count.
 */
const SUCCESSFUL_TASK_REVIEW_STATUSES = Object.freeze([
  'pending',
  'submitted',
  'under_review',
  'graded',
  'approved',
]);

const UNSUCCESSFUL_TASK_REVIEW_STATUSES = Object.freeze(['needs_revision', 'rejected']);

const ENROLLED_APPLICATION_STATUSES = new Set(['approved']);
const CANCELLED_STATUSES = new Set(['cancelled']);

function isRequiredActiveTask(task) {
  if (!task) return false;
  if (task.archived_at || task.deleted_at) return false;
  if (task.is_required === false || task.optional === true) return false;
  if (task.is_published === false) return false;
  const status = String(task.status || '').toLowerCase();
  if (status && ['draft', 'archived', 'cancelled', 'deleted', 'inactive'].includes(status)) {
    return false;
  }
  const assignees = task.assignee_ids || task.assigned_student_ids || task.assigned_to;
  if (Array.isArray(assignees) && assignees.length) {
    return true;
  }
  return true;
}

function isTaskAssignedToStudent(task, studentId) {
  if (!isRequiredActiveTask(task)) return false;
  const assignees = task.assignee_ids || task.assigned_student_ids || task.assigned_to;
  if (!Array.isArray(assignees) || !assignees.length) return true;
  if (!studentId) return true;
  return assignees.map(String).includes(String(studentId));
}

function submissionCountsTowardProgress(submission) {
  if (!submission) return false;
  if (submission.deleted_at || submission.archived_at) return false;
  const status = String(submission.review_status || submission.status || '').toLowerCase();
  if (UNSUCCESSFUL_TASK_REVIEW_STATUSES.includes(status)) return false;
  if (status === 'draft' || status === 'cancelled') return false;
  return SUCCESSFUL_TASK_REVIEW_STATUSES.includes(status);
}

function resolveProgressStatus(totalRequired, submittedRequired) {
  const total = Math.max(0, Number(totalRequired) || 0);
  const submitted = Math.max(0, Math.min(total, Number(submittedRequired) || 0));
  if (total <= 0) return TASK_PROGRESS_STATUS.NO_REQUIRED_TASKS;
  if (submitted <= 0) return TASK_PROGRESS_STATUS.NOT_STARTED;
  if (submitted >= total) return TASK_PROGRESS_STATUS.COMPLETED;
  return TASK_PROGRESS_STATUS.IN_PROGRESS;
}

function formatProgressDisplay(status, submittedRequired, totalRequired, { cancelled = false } = {}) {
  if (cancelled) {
    if (totalRequired > 0) {
      return `${submittedRequired} / ${totalRequired} — ${TASK_PROGRESS_LABEL_AR.cancelled}`;
    }
    return TASK_PROGRESS_LABEL_AR.cancelled;
  }
  if (status === TASK_PROGRESS_STATUS.NO_REQUIRED_TASKS) {
    return TASK_PROGRESS_LABEL_AR.no_required_tasks;
  }
  return `${submittedRequired} / ${totalRequired} — ${TASK_PROGRESS_LABEL_AR[status]}`;
}

function isCancelledContext(applicationStatus, opportunityStatus) {
  return (
    CANCELLED_STATUSES.has(String(applicationStatus || '')) ||
    CANCELLED_STATUSES.has(String(opportunityStatus || ''))
  );
}

/**
 * @param {{
 *   applicationStatus?: string,
 *   opportunityStatus?: string,
 *   totalRequired?: number,
 *   submittedRequired?: number,
 * }} input
 */
function deriveTaskProgress(input = {}) {
  const applicationStatus = input.applicationStatus || null;
  const opportunityStatus = input.opportunityStatus || null;
  const totalRequired = Math.max(0, Number(input.totalRequired) || 0);
  const submittedRequired = Math.max(0, Number(input.submittedRequired) || 0);
  const cancelled = isCancelledContext(applicationStatus, opportunityStatus);
  const enrolled = ENROLLED_APPLICATION_STATUSES.has(String(applicationStatus || ''));
  const status = resolveProgressStatus(totalRequired, submittedRequired);
  const visible = enrolled || cancelled;

  if (!visible) {
    return {
      enrolled: false,
      status: null,
      label_ar: null,
      label_en: null,
      submitted_required: 0,
      total_required: totalRequired,
      display: null,
      primary_status: applicationStatus || null,
      primary_label_ar: applicationStatus
        ? labels.labelOf(labels.APPLICATION_STATUS_AR, applicationStatus, null)
        : null,
    };
  }

  const primaryStatus = cancelled ? 'cancelled' : status;
  return {
    enrolled: true,
    status,
    label_ar: TASK_PROGRESS_LABEL_AR[status],
    label_en: TASK_PROGRESS_LABEL_EN[status],
    submitted_required: status === TASK_PROGRESS_STATUS.NO_REQUIRED_TASKS ? 0 : submittedRequired,
    total_required: totalRequired,
    display: formatProgressDisplay(status, submittedRequired, totalRequired, { cancelled }),
    primary_status: primaryStatus,
    primary_label_ar: TASK_PROGRESS_LABEL_AR[primaryStatus] || TASK_PROGRESS_LABEL_AR[status],
  };
}

function countProgressFromLoadedRows({ application, tasks = [], submissions = [] }) {
  const studentId = application?.student_id;
  const opportunityId = application?.opportunity_id;
  const requiredTasks = tasks.filter(
    (task) =>
      String(task.opportunity_id) === String(opportunityId) && isTaskAssignedToStudent(task, studentId)
  );
  const requiredIds = new Set(requiredTasks.map((task) => String(task.id)));
  const submittedTaskIds = new Set();
  for (const submission of submissions) {
    if (String(submission.application_id) !== String(application.id)) continue;
    if (!requiredIds.has(String(submission.task_id))) continue;
    if (!submissionCountsTowardProgress(submission)) continue;
    submittedTaskIds.add(String(submission.task_id));
  }
  return deriveTaskProgress({
    applicationStatus: application.status,
    opportunityStatus: application.opportunity_status || application.opportunity?.status,
    totalRequired: requiredTasks.length,
    submittedRequired: submittedTaskIds.size,
  });
}

function requiredTaskWhere(opportunityIds) {
  return {
    opportunity_id: { in: opportunityIds },
    is_required: true,
  };
}

function successfulSubmissionWhere(applicationIds, opportunityIds) {
  return {
    application_id: { in: applicationIds },
    review_status: { in: [...SUCCESSFUL_TASK_REVIEW_STATUSES] },
    field_training_tasks: {
      opportunity_id: { in: opportunityIds },
      is_required: true,
    },
  };
}

/**
 * Batch-calculate progress for many applications without N+1 queries.
 * @param {Array<{ id: string, opportunity_id: string, student_id?: string, status?: string }>} applications
 * @param {{ opportunitiesById?: Map<string, { status?: string }> }} [options]
 * @returns {Promise<Map<string, object>>}
 */
async function calculateTaskProgressForApplications(applications, options = {}) {
  const apps = (applications || []).filter((app) => app?.id && app?.opportunity_id);
  const result = new Map();
  if (!apps.length) return result;

  const applicationIds = [...new Set(apps.map((app) => app.id))];
  const opportunityIds = [...new Set(apps.map((app) => app.opportunity_id))];
  const opportunitiesById = options.opportunitiesById || new Map();

  const [requiredGroups, submittedGroups] = await Promise.all([
    prisma.field_training_tasks.groupBy({
      by: ['opportunity_id'],
      where: requiredTaskWhere(opportunityIds),
      _count: { _all: true },
    }),
    prisma.field_training_task_submissions.groupBy({
      by: ['application_id'],
      where: successfulSubmissionWhere(applicationIds, opportunityIds),
      _count: { _all: true },
    }),
  ]);

  const requiredByOpp = new Map(
    requiredGroups.map((row) => [row.opportunity_id, row._count?._all ?? 0])
  );
  const submittedByApp = new Map(
    submittedGroups.map((row) => [row.application_id, row._count?._all ?? 0])
  );

  for (const app of apps) {
    const opp = opportunitiesById.get?.(app.opportunity_id) || opportunitiesById[app.opportunity_id];
    result.set(
      app.id,
      deriveTaskProgress({
        applicationStatus: app.status,
        opportunityStatus: app.opportunity_status || opp?.status,
        totalRequired: requiredByOpp.get(app.opportunity_id) || 0,
        submittedRequired: submittedByApp.get(app.id) || 0,
      })
    );
  }
  return result;
}

async function calculateTaskProgressForApplication(application, options = {}) {
  if (!application?.id) return deriveTaskProgress({ applicationStatus: application?.status });
  const map = await calculateTaskProgressForApplications([application], options);
  return (
    map.get(application.id) ||
    deriveTaskProgress({
      applicationStatus: application.status,
      opportunityStatus: options.opportunity?.status,
      totalRequired: 0,
      submittedRequired: 0,
    })
  );
}

module.exports = {
  TASK_PROGRESS_STATUS,
  TASK_PROGRESS_LABEL_AR,
  TASK_PROGRESS_LABEL_EN,
  SUCCESSFUL_TASK_REVIEW_STATUSES,
  UNSUCCESSFUL_TASK_REVIEW_STATUSES,
  isRequiredActiveTask,
  isTaskAssignedToStudent,
  submissionCountsTowardProgress,
  resolveProgressStatus,
  formatProgressDisplay,
  deriveTaskProgress,
  countProgressFromLoadedRows,
  requiredTaskWhere,
  successfulSubmissionWhere,
  calculateTaskProgressForApplications,
  calculateTaskProgressForApplication,
};
