'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess, isSystemWideAdmin } = require('../../utils/organizationScope');
const { emitDomainEvent } = require('../notificationEngine');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');

const REVISION_STATUSES = new Set(['REVISION_REQUESTED', 'REOPENED', 'RETURNED']);

function requireOrgWrite(requester) {
  if (isSystemWideAdmin(requester)) return;
  if (requester.roles?.includes('reviewer')) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only');
  }
  if (
    !requester.roles?.includes('admin') &&
    !requester.roles?.includes('instructor') &&
    !requester.roles?.includes('trainer')
  ) {
    throw new ApiError(403, 'Forbidden');
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

function parseSettings(settingsJson) {
  return settingsJson && typeof settingsJson === 'object' ? settingsJson : {};
}

function pickLatestSubmission(submissions) {
  if (!submissions?.length) return null;
  return [...submissions].sort((a, b) => {
    const attemptDiff = (b.attempt_no || 0) - (a.attempt_no || 0);
    if (attemptDiff !== 0) return attemptDiff;
    return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
  })[0];
}

function mapSubmission(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    status: sub.status,
    score: sub.score,
    feedback: sub.feedback,
    attemptNo: sub.attempt_no,
    contentText: sub.content_text,
    contentUrl: sub.content_url,
    submittedAt: sub.submitted_at,
    gradedAt: sub.graded_at,
  };
}

function canSubmitTask(task, submissions) {
  const count = submissions?.length || 0;
  const maxAttempts = task.max_attempts ?? 3;
  if (count >= maxAttempts) return false;
  if (count === 0) return true;
  if (task.allow_resubmit) return true;
  const latest = pickLatestSubmission(submissions);
  return Boolean(latest && REVISION_STATUSES.has(latest.status));
}

function mapTraineeTask(task, submissions) {
  const settings = parseSettings(task.settings_json);
  const latest = pickLatestSubmission(submissions);
  return {
    id: task.id,
    title: task.title,
    instructions: task.instructions,
    dueAt: task.due_at,
    isRequired: task.is_required,
    isFinalTask: task.is_final_task,
    maxScore: task.max_score,
    allowResubmit: task.allow_resubmit,
    maxAttempts: task.max_attempts,
    gradingMode: task.grading_mode,
    attachmentUrl: settings.attachmentUrl || null,
    hasAttachment: Boolean(settings.attachmentStorageKey || settings.attachmentFileId),
    externalLinks: Array.isArray(settings.externalLinks) ? settings.externalLinks : [],
    allowedFileTypes: Array.isArray(settings.allowedFileTypes) ? settings.allowedFileTypes : [],
    attemptCount: submissions?.length || 0,
    canSubmit: canSubmitTask(task, submissions),
    submission: mapSubmission(latest),
  };
}

async function getTraineeTaskListExtras(_programId, tasks, submissions) {
  const byTask = new Map();
  for (const sub of submissions || []) {
    if (!byTask.has(sub.task_id)) byTask.set(sub.task_id, []);
    byTask.get(sub.task_id).push(sub);
  }
  return (tasks || []).map((task) => mapTraineeTask(task, byTask.get(task.id) || []));
}

async function hydrateAttachmentSettings(settings, body) {
  const next = { ...(settings && typeof settings === 'object' ? settings : {}) };
  if (Array.isArray(body?.external_links)) next.externalLinks = body.external_links;
  if (Array.isArray(body?.allowed_file_types)) next.allowedFileTypes = body.allowed_file_types;
  if (body?.attachment_url !== undefined) next.attachmentUrl = body.attachment_url || null;
  if (body?.attachment_storage_key !== undefined) {
    next.attachmentStorageKey = body.attachment_storage_key || null;
  }
  if (body?.attachment_file_id !== undefined) {
    next.attachmentFileId = body.attachment_file_id || null;
    if (body.attachment_file_id) {
      const file = await prisma.files.findFirst({
        where: { id: body.attachment_file_id, deleted_at: null },
      });
      if (file) {
        next.attachmentStorageKey = file.storage_key;
        if (file.url) next.attachmentUrl = file.url;
      }
    }
  }
  return next;
}

async function loadTaskOrThrow(taskId) {
  const task = await prisma.training_tasks.findUnique({
    where: { id: taskId },
    include: { training_programs: true },
  });
  if (!task) throw new ApiError(404, 'Task not found');
  return task;
}

async function findEnrollment(requester, task, statuses) {
  return prisma.training_enrollments.findFirst({
    where: {
      user_id: requester.userId,
      organization_id: task.training_programs.organization_id,
      status: { in: statuses },
      training_cohorts: { program_id: task.program_id },
      ...(task.cohort_id ? { cohort_id: task.cohort_id } : {}),
    },
    orderBy: { created_at: 'desc' },
  });
}

async function findActiveEnrollment(requester, task) {
  return findEnrollment(requester, task, ['ACTIVE', 'APPROVED']);
}

async function requireStaffTaskAccess(requester, task, permissionKey) {
  requireOrgWrite(requester);
  assertOrganizationAccess(requester, task.training_programs.organization_id);
  await assertTrainerProgramAccess(requester, task.program_id, permissionKey);
}

async function submitTask(requester, taskId, body) {
  const task = await loadTaskOrThrow(taskId);
  if (!task.published_at) throw new ApiError(403, 'Task is not published', null, 'TASK_NOT_AVAILABLE');
  const enrollment = await findActiveEnrollment(requester, task);
  if (!enrollment) throw new ApiError(403, 'Not enrolled');
  if (task.due_at && new Date() > new Date(task.due_at)) {
    throw new ApiError(400, 'انتهى موعد تسليم المهمة', null, 'TASK_NOT_AVAILABLE');
  }

  const submissions = await prisma.training_task_submissions.findMany({
    where: { task_id: taskId, enrollment_id: enrollment.id },
  });
  if (!canSubmitTask(task, submissions)) {
    throw new ApiError(400, 'لا يمكن تسليم هذه المهمة حالياً', null, 'TASK_NOT_AVAILABLE');
  }

  const row = await prisma.training_task_submissions.create({
    data: {
      task_id: taskId,
      enrollment_id: enrollment.id,
      user_id: requester.userId,
      attempt_no: submissions.length + 1,
      content_text: body.content_text ?? null,
      content_url: body.content_url ?? null,
      status: task.grading_mode === 'NONE' ? 'ACCEPTED' : 'SUBMITTED',
    },
  });
  await emitDomainEvent('TASK_SUBMITTED', {
    organizationId: task.training_programs.organization_id,
    affectedUserId: requester.userId,
    entityType: 'training_task_submission',
    entityId: row.id,
  }).catch(() => null);
  const { computeAndPersistProgress } = require('./trainingPrograms.service');
  await computeAndPersistProgress(enrollment.id).catch(() => null);
  return { id: row.id, status: row.status, attemptNo: row.attempt_no };
}

async function resubmitTask(requester, taskId, _submissionId, body) {
  return submitTask(requester, taskId, body || {});
}

async function gradeTask(requester, submissionId, body) {
  const submission = await prisma.training_task_submissions.findUnique({
    where: { id: submissionId },
    include: { training_tasks: { include: { training_programs: true } } },
  });
  if (!submission) throw new ApiError(404, 'Submission not found');
  await requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
  const row = await prisma.training_task_submissions.update({
    where: { id: submissionId },
    data: {
      score: body.score ?? null,
      feedback: body.feedback ?? null,
      status: body.status || 'GRADED',
      graded_by: requester.userId,
      graded_at: new Date(),
      updated_at: new Date(),
    },
  });
  await emitDomainEvent('TASK_GRADED', {
    organizationId: submission.training_tasks.training_programs.organization_id,
    affectedUserId: submission.user_id,
    entityType: 'training_task_submission',
    entityId: row.id,
  }).catch(() => null);
  const { computeAndPersistProgress } = require('./trainingPrograms.service');
  await computeAndPersistProgress(submission.enrollment_id).catch(() => null);
  return { id: row.id, score: row.score, status: row.status };
}

async function findViewableEnrollment(requester, task) {
  return findEnrollment(requester, task, [
    'ACTIVE',
    'APPROVED',
    'REQUIREMENTS_COMPLETED',
    'COMPLETED',
  ]);
}

async function getTaskForRequester(requester, taskId) {
  const task = await loadTaskOrThrow(taskId);
  const enrollment = await findViewableEnrollment(requester, task);
  const isStaff =
    isSystemWideAdmin(requester) ||
    requester.roles?.includes('admin') ||
    requester.roles?.includes('instructor') ||
    requester.roles?.includes('trainer');
  if (!enrollment && !isStaff) throw new ApiError(403, 'Not enrolled');
  if (isStaff) {
    try {
      assertOrganizationAccess(requester, task.training_programs.organization_id);
    } catch (err) {
      if (!enrollment) throw err;
    }
  }
  const submissions = enrollment
    ? await prisma.training_task_submissions.findMany({
        where: { task_id: taskId, enrollment_id: enrollment.id },
      })
    : [];
  return mapTraineeTask(task, submissions);
}

function resolveAttachmentUrl(settings) {
  if (settings.attachmentUrl) return settings.attachmentUrl;
  if (settings.attachmentStorageKey) return resolvePublicUrl(settings.attachmentStorageKey);
  return null;
}

async function getInstructionFileUrl(requester, taskId) {
  const task = await loadTaskOrThrow(taskId);
  assertOrganizationAccess(requester, task.training_programs.organization_id);
  const enrollment = await findViewableEnrollment(requester, task);
  const isStaff =
    isSystemWideAdmin(requester) ||
    requester.roles?.includes('admin') ||
    requester.roles?.includes('instructor') ||
    requester.roles?.includes('trainer');
  if (isStaff) {
    await assertTrainerProgramAccess(requester, task.program_id);
  } else if (!enrollment) {
    throw new ApiError(403, 'Not enrolled');
  }
  const settings = parseSettings(task.settings_json);
  if (settings.attachmentFileId) {
    const file = await prisma.files.findFirst({
      where: { id: settings.attachmentFileId, deleted_at: null },
    });
    if (file) {
      return { url: file.url || resolvePublicUrl(file.storage_key), expiresIn: null };
    }
  }
  const url = resolveAttachmentUrl(settings);
  if (!url) throw new ApiError(404, 'Attachment not found');
  return { url, expiresIn: null };
}

async function getMySubmission(requester, taskId) {
  const task = await loadTaskOrThrow(taskId);
  const enrollment = await findViewableEnrollment(requester, task);
  if (!enrollment) throw new ApiError(403, 'Not enrolled');
  const submissions = await prisma.training_task_submissions.findMany({
    where: { task_id: taskId, enrollment_id: enrollment.id },
  });
  const latest = pickLatestSubmission(submissions);
  if (!latest) throw new ApiError(404, 'Submission not found');
  return mapSubmission(latest);
}

async function loadSubmissionOrThrow(submissionId) {
  const submission = await prisma.training_task_submissions.findUnique({
    where: { id: submissionId },
    include: { training_tasks: { include: { training_programs: true } } },
  });
  if (!submission) throw new ApiError(404, 'Submission not found');
  return submission;
}

async function getSubmissionFileUrl(requester, submissionId) {
  const submission = await loadSubmissionOrThrow(submissionId);
  const isOwner = submission.user_id === requester.userId;
  if (!isOwner) {
    await requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
  }
  if (!submission.content_url) throw new ApiError(404, 'Submission file not found');
  return { url: resolvePublicUrl(submission.content_url) || submission.content_url, expiresIn: null };
}

async function listTaskSubmissions(requester, taskId) {
  const task = await loadTaskOrThrow(taskId);
  await requireStaffTaskAccess(requester, task, 'can_grade_tasks');
  const rows = await prisma.training_task_submissions.findMany({
    where: { task_id: taskId },
    orderBy: [{ submitted_at: 'desc' }],
  });
  return rows.map((row) => ({
    ...mapSubmission(row),
    userId: row.user_id,
    enrollmentId: row.enrollment_id,
  }));
}

async function getTaskSubmission(requester, submissionId) {
  const submission = await loadSubmissionOrThrow(submissionId);
  const isOwner = submission.user_id === requester.userId;
  if (!isOwner) {
    await requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
  }
  return {
    ...mapSubmission(submission),
    userId: submission.user_id,
    enrollmentId: submission.enrollment_id,
    taskId: submission.task_id,
  };
}

async function requestRevision(requester, submissionId, body) {
  const submission = await loadSubmissionOrThrow(submissionId);
  await requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
  const row = await prisma.training_task_submissions.update({
    where: { id: submissionId },
    data: {
      status: 'REVISION_REQUESTED',
      feedback: body.feedback ?? submission.feedback,
      updated_at: new Date(),
    },
  });
  return { id: row.id, status: row.status, feedback: row.feedback };
}

async function reopenSubmission(requester, submissionId, body) {
  const submission = await loadSubmissionOrThrow(submissionId);
  await requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
  const row = await prisma.training_task_submissions.update({
    where: { id: submissionId },
    data: {
      status: 'REOPENED',
      feedback: body.feedback ?? submission.feedback,
      updated_at: new Date(),
    },
  });
  return { id: row.id, status: row.status, feedback: row.feedback };
}

module.exports = {
  hydrateAttachmentSettings,
  getTraineeTaskListExtras,
  mapTraineeTask,
  canSubmitTask,
  submitTask,
  gradeTask,
  getTaskForRequester,
  getInstructionFileUrl,
  getMySubmission,
  resubmitTask,
  getSubmissionFileUrl,
  listTaskSubmissions,
  getTaskSubmission,
  requestRevision,
  reopenSubmission,
};
