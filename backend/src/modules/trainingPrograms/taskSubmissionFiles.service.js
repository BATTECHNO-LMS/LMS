'use strict';

const path = require('path');
const fs = require('fs');
const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const { ApiError } = require('../../utils/apiError');
const { log } = require('../../utils/logger');
const { getProvider, getStorageBackend } = require('../../shared/storage/storageProvider');
const { buildStorageKey, assertSafeStorageKey } = require('../../shared/storage/fileRules');
const filesRepo = require('../files/files.repository');
const { recordAudit } = require('../../utils/auditRecorder');
const rules = require('./taskSubmissionFileRules');

const AUDIT_CONTEXT = 'training_task_submission';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function workflow() {
  return require('./trainingTaskWorkflow.service');
}

function fail(status, code) {
  return new ApiError(status, rules.ERROR_MESSAGES[code] || rules.ERROR_MESSAGES.UPLOAD_FAILED, null, code);
}

function mapAttachment(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.size || 0),
    isArchive: Boolean(row.is_archive),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

async function removeStoredObject(storageKey) {
  try {
    await getProvider().deleteObject(storageKey);
  } catch {
    /* best effort */
  }
}

async function safeUnlink(p) {
  if (!p) return;
  try {
    await fs.promises.unlink(p);
  } catch {
    /* ignore */
  }
}

/**
 * Ensure the requester can currently add files to this task (enrolled, published, open, attempts left).
 */
async function assertCanUploadForTask(requester, taskId) {
  const wf = workflow();
  const task = await wf.loadTaskOrThrow(taskId);
  if (!task.published_at) throw new ApiError(403, 'المهمة غير متاحة حالياً', null, 'TASK_NOT_AVAILABLE');
  const enrollment = await wf.findActiveEnrollment(requester, task);
  if (!enrollment) throw new ApiError(403, 'يجب أن تكون مسجلاً في الدورة لرفع ملفات التسليم', null, 'NOT_ENROLLED');
  if (task.due_at && new Date() > new Date(task.due_at)) {
    throw new ApiError(400, 'انتهى موعد تسليم المهمة', null, 'TASK_NOT_AVAILABLE');
  }
  const submissions = await prisma.training_task_submissions.findMany({
    where: { task_id: taskId, enrollment_id: enrollment.id },
    select: { id: true, attempt_no: true, status: true, submitted_at: true },
  });
  if (!wf.canSubmitTask(task, submissions)) {
    throw new ApiError(400, 'لا يمكن تسليم هذه المهمة حالياً', null, 'TASK_NOT_AVAILABLE');
  }
  return { task, enrollment };
}

/**
 * Store one attachment as a draft owned by the requester. It becomes part of a submission
 * only when the submission is created (atomically) with its id in `file_ids`.
 * @param {object} requester
 * @param {string} taskId
 * @param {{ path?: string, buffer?: Buffer, originalname: string, mimetype?: string, size: number }} file
 */
async function uploadDraftFile(requester, taskId, file) {
  if (!file) throw fail(400, 'FILE_REQUIRED');
  const tmpPath = file.path || null;
  try {
    const originalName = rules.decodeMultipartFileName(file.originalname);
    const check = rules.validateSubmissionFile({
      fileName: originalName,
      mimeType: file.mimetype,
      size: file.size,
    });
    if (!check.valid) throw fail(check.code === 'FILE_TOO_LARGE' ? 413 : 400, check.code);

    await assertCanUploadForTask(requester, taskId);

    const drafts = await prisma.files.count({
      where: {
        created_by_id: requester.userId,
        related_entity_type: rules.DRAFT_ENTITY_TYPE,
        related_entity_id: taskId,
        deleted_at: null,
      },
    });
    if (drafts >= rules.MAX_FILES_PER_SUBMISSION) throw fail(400, 'TOO_MANY_FILES');

    const storageKey = buildStorageKey('training', check.originalName);
    assertSafeStorageKey(storageKey);
    const provider = getProvider();
    try {
      if (tmpPath && typeof provider.putObjectFile === 'function') {
        await provider.putObjectFile(storageKey, tmpPath, check.mimeType, check.size);
      } else if (file.buffer) {
        await provider.putObjectBuffer(storageKey, file.buffer, check.mimeType);
      } else {
        throw new Error('No file payload');
      }
    } catch (err) {
      log('warn', 'task submission file storage failed', { err: err?.message, taskId });
      await removeStoredObject(storageKey);
      throw fail(503, 'STORAGE_ERROR');
    }

    let record;
    try {
      record = await filesRepo.createFile({
        userId: requester.userId,
        createdById: requester.userId,
        relatedEntityType: rules.DRAFT_ENTITY_TYPE,
        relatedEntityId: taskId,
        originalName: check.originalName,
        storageKey,
        bucket: getStorageBackend() === 'r2' ? env.R2_BUCKET_NAME : env.UPLOAD_DIR || 'uploads',
        mimeType: check.mimeType,
        size: check.size,
        visibility: 'private',
        url: null,
      });
    } catch (err) {
      log('warn', 'task submission file record failed', { err: err?.message, taskId });
      await removeStoredObject(storageKey);
      throw fail(503, 'STORAGE_ERROR');
    }

    await recordAudit({
      userId: requester.userId,
      subjectUserId: requester.userId,
      actionType: 'FILE_UPLOADED',
      entityType: 'file',
      entityId: record.id,
      newValues: {
        context: AUDIT_CONTEXT,
        taskId,
        fileName: check.originalName,
        sizeBytes: Number(check.size || 0),
        mimeType: check.mimeType,
      },
    });

    return {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      isArchive: check.isArchive,
    };
  } finally {
    await safeUnlink(tmpPath);
  }
}

async function listDraftFiles(requester, taskId) {
  const rows = await prisma.files.findMany({
    where: {
      created_by_id: requester.userId,
      related_entity_type: rules.DRAFT_ENTITY_TYPE,
      related_entity_id: taskId,
      deleted_at: null,
    },
    orderBy: { created_at: 'asc' },
    select: { id: true, original_name: true, mime_type: true, size: true },
  });
  return rows.map((r) => ({
    id: r.id,
    originalName: r.original_name,
    mimeType: r.mime_type,
    size: Number(r.size || 0),
  }));
}

async function deleteDraftFile(requester, taskId, fileId) {
  const row = await prisma.files.findFirst({
    where: {
      id: fileId,
      created_by_id: requester.userId,
      related_entity_type: rules.DRAFT_ENTITY_TYPE,
      related_entity_id: taskId,
      deleted_at: null,
    },
  });
  if (!row) throw new ApiError(404, 'الملف غير موجود أو تم تسليمه بالفعل', null, 'FILE_NOT_FOUND');
  await removeStoredObject(row.storage_key);
  await prisma.files.update({
    where: { id: row.id },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  await recordAudit({
    userId: requester.userId,
    subjectUserId: requester.userId,
    actionType: 'FILE_DELETED',
    entityType: 'file',
    entityId: row.id,
    oldValues: {
      context: AUDIT_CONTEXT,
      taskId,
      fileName: row.original_name,
      sizeBytes: Number(row.size || 0),
      mimeType: row.mime_type || null,
    },
  });
  return { id: row.id, removed: true };
}

/**
 * Resolve and verify draft files the requester wants to attach. Throws on any mismatch so
 * the submission is never created with missing attachments.
 * @returns {Promise<Array<object>>} files rows in requested order
 */
async function resolveDraftFilesForSubmit(requester, taskId, fileIds) {
  const ids = [...new Set((Array.isArray(fileIds) ? fileIds : []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  if (ids.length > rules.MAX_FILES_PER_SUBMISSION) throw fail(400, 'TOO_MANY_FILES');
  if (ids.some((id) => !UUID_RE.test(id))) throw fail(400, 'FILE_NOT_AVAILABLE');
  const rows = await prisma.files.findMany({
    where: {
      id: { in: ids },
      created_by_id: requester.userId,
      related_entity_type: rules.DRAFT_ENTITY_TYPE,
      related_entity_id: taskId,
      deleted_at: null,
    },
  });
  if (rows.length !== ids.length) throw fail(400, 'FILE_NOT_AVAILABLE');
  const setCheck = rules.validateSubmissionFileSet(rows.map((r) => ({ size: Number(r.size) })));
  if (!setCheck.valid) throw fail(400, setCheck.code);

  const provider = getProvider();
  for (const row of rows) {
    let head = null;
    try {
      head = await provider.headObject(row.storage_key);
    } catch {
      head = null;
    }
    if (!head) throw fail(400, 'FILE_NOT_AVAILABLE');
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id));
}

/**
 * Inside a Prisma transaction: link verified drafts to the new submission.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function attachFilesInTransaction(tx, submissionId, taskId, requester, fileRows) {
  if (!fileRows.length) return [];
  const claimed = await tx.files.updateMany({
    where: {
      id: { in: fileRows.map((r) => r.id) },
      created_by_id: requester.userId,
      related_entity_type: rules.DRAFT_ENTITY_TYPE,
      related_entity_id: taskId,
      deleted_at: null,
    },
    data: {
      related_entity_type: rules.ATTACHED_ENTITY_TYPE,
      related_entity_id: submissionId,
      updated_at: new Date(),
    },
  });
  if (claimed.count !== fileRows.length) throw fail(409, 'FILE_NOT_AVAILABLE');
  const { isArchiveFile } = require('../fieldTraining/fieldTraining.submissionFileRules');
  await tx.training_task_submission_files.createMany({
    data: fileRows.map((r, idx) => ({
      submission_id: submissionId,
      file_id: r.id,
      storage_key: r.storage_key,
      original_name: r.original_name,
      mime_type: r.mime_type,
      size: r.size,
      sort_order: idx,
      is_archive: isArchiveFile(r.original_name, r.mime_type),
    })),
  });
  return fileRows.length;
}

/** Remove the requester's abandoned drafts (older than the TTL). Best effort. */
async function cleanupStaleDrafts(userId) {
  try {
    const cutoff = new Date(Date.now() - rules.DRAFT_TTL_MS);
    const stale = await prisma.files.findMany({
      where: {
        created_by_id: userId,
        related_entity_type: rules.DRAFT_ENTITY_TYPE,
        deleted_at: null,
        created_at: { lt: cutoff },
      },
      select: { id: true, storage_key: true },
      take: 50,
    });
    for (const row of stale) {
      await removeStoredObject(row.storage_key);
      await prisma.files.update({
        where: { id: row.id },
        data: { deleted_at: new Date(), updated_at: new Date() },
      });
    }
    return stale.length;
  } catch (err) {
    log('warn', 'stale task submission draft cleanup failed', { err: err?.message });
    return 0;
  }
}

async function listAttachmentsBySubmissionIds(submissionIds) {
  const ids = [...new Set((submissionIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  const rows = await prisma.training_task_submission_files.findMany({
    where: { submission_id: { in: ids } },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  for (const row of rows) {
    if (!map.has(row.submission_id)) map.set(row.submission_id, []);
    map.get(row.submission_id).push(mapAttachment(row));
  }
  return map;
}

async function assertCanReadSubmission(requester, submission) {
  if (submission.user_id === requester.userId) return;
  await workflow().requireStaffTaskAccess(requester, submission.training_tasks, 'can_grade_tasks');
}

function normalizeLegacyStorageKey(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  let key = s;
  if (/^https?:\/\//i.test(s)) {
    try {
      const pathname = decodeURIComponent(new URL(s).pathname || '');
      const idx = pathname.indexOf('/uploads/');
      if (idx < 0) return null;
      key = pathname.slice(idx + 1);
    } catch {
      return null;
    }
  }
  key = key.replace(/^\/+/, '');
  if (!key.startsWith('uploads/')) key = `uploads/${key}`;
  try {
    return assertSafeStorageKey(key);
  } catch {
    return null;
  }
}

function legacyDisplayName(storageKey) {
  const base = path.basename(storageKey || 'file');
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '') || 'file';
}

async function openStoredObject(storageKey) {
  try {
    return await getProvider().getObjectStream(storageKey);
  } catch {
    throw new ApiError(404, 'الملف غير متاح في التخزين', null, 'FILE_NOT_FOUND');
  }
}

/**
 * @returns {Promise<{ stream: NodeJS.ReadableStream, contentLength: number|null, fileName: string, mimeType: string }>}
 */
async function openSubmissionAttachment(requester, submissionId, attachmentId) {
  const submission = await workflow().loadSubmissionOrThrow(submissionId);
  await assertCanReadSubmission(requester, submission);
  const row = await prisma.training_task_submission_files.findFirst({
    where: { id: attachmentId, submission_id: submissionId },
  });
  if (!row) throw new ApiError(404, 'الملف غير موجود', null, 'FILE_NOT_FOUND');
  const opened = await openStoredObject(row.storage_key);
  await recordAudit({
    userId: requester.userId,
    subjectUserId: submission.user_id ?? null,
    actionType: 'FILE_DOWNLOADED',
    entityType: 'file',
    entityId: row.file_id ?? row.id,
    newValues: {
      context: AUDIT_CONTEXT,
      submissionId,
      taskId: submission.task_id ?? null,
      fileName: row.original_name,
      sizeBytes: Number(row.size || 0),
      mimeType: row.mime_type || null,
    },
  });
  return {
    ...opened,
    fileName: row.original_name,
    mimeType: row.mime_type || 'application/octet-stream',
  };
}

/**
 * Legacy single-file submissions (content_url). External URLs are returned for the client to open.
 */
async function openLegacySubmissionFile(requester, submissionId) {
  const submission = await workflow().loadSubmissionOrThrow(submissionId);
  await assertCanReadSubmission(requester, submission);
  if (!submission.content_url) throw new ApiError(404, 'لا يوجد ملف لهذا التسليم', null, 'FILE_NOT_FOUND');
  const storageKey = normalizeLegacyStorageKey(submission.content_url);
  if (!storageKey) {
    if (/^https?:\/\//i.test(submission.content_url)) {
      return { mode: 'external', url: submission.content_url };
    }
    throw new ApiError(404, 'لا يوجد ملف لهذا التسليم', null, 'FILE_NOT_FOUND');
  }
  const record = await prisma.files.findFirst({
    where: { storage_key: storageKey, deleted_at: null },
    select: { id: true, original_name: true, mime_type: true, size: true },
  });
  const opened = await openStoredObject(storageKey);
  await recordAudit({
    userId: requester.userId,
    subjectUserId: submission.user_id ?? null,
    actionType: 'FILE_DOWNLOADED',
    entityType: 'file',
    entityId: record?.id ?? null,
    newValues: {
      context: AUDIT_CONTEXT,
      submissionId,
      taskId: submission.task_id ?? null,
      fileName: record?.original_name || legacyDisplayName(storageKey),
      sizeBytes: record?.size != null ? Number(record.size) : opened?.contentLength ?? null,
      mimeType: record?.mime_type || null,
    },
  });
  return {
    mode: 'stream',
    ...opened,
    fileName: record?.original_name || legacyDisplayName(storageKey),
    mimeType: record?.mime_type || 'application/octet-stream',
  };
}

module.exports = {
  mapAttachment,
  uploadDraftFile,
  listDraftFiles,
  deleteDraftFile,
  resolveDraftFilesForSubmit,
  attachFilesInTransaction,
  cleanupStaleDrafts,
  listAttachmentsBySubmissionIds,
  openSubmissionAttachment,
  openLegacySubmissionFile,
  normalizeLegacyStorageKey,
  legacyDisplayName,
  assertCanUploadForTask,
};
