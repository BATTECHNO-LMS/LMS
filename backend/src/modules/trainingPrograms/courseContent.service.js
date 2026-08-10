'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../shared/services/audit.service');
const { getProvider, getStorageBackend } = require('../../shared/storage/storageProvider');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const filesRepo = require('../files/files.repository');
const { assertOrganizationAccess } = require('../../utils/organizationScope');
const { isSystemWideAdmin } = require('../../utils/universityScope');

const RECORDED_LECTURE_TYPE = 'RECORDED_LECTURE';
const EDUCATIONAL_TYPES = new Set(['LINK', 'FILE', 'DOCUMENT', 'IMAGE', 'ARCHIVE', 'OTHER']);

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

function roleOf(requester) {
  if (isSystemWideAdmin(requester)) return 'super_admin';
  if (requester.roles?.includes('admin')) return 'admin';
  if (requester.roles?.includes('trainer')) return 'trainer';
  if (requester.roles?.includes('trainee')) return 'trainee';
  if (requester.roles?.includes('student')) return 'student';
  return 'user';
}

function safeAuditValues(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (/secret|token|password|credential|key$/i.test(k) && typeof v === 'string') continue;
    out[k] = v;
  }
  return out;
}

async function loadProgramOrThrow(programId) {
  const program = await prisma.training_programs.findUnique({ where: { id: programId } });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }
  return program;
}

async function assertManageMaterials(requester, programId) {
  requireOrgWrite(requester);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_materials');
}

async function assertManageTasks(requester, programId) {
  requireOrgWrite(requester);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_tasks');
}

async function assertCanViewProgramContent(requester, program) {
  assertOrganizationAccess(requester, program.organization_id);
  const isLearner =
    requester.roles?.includes('trainee') || requester.roles?.includes('student');
  if (isLearner && !isSystemWideAdmin(requester) && !requester.roles?.includes('admin')) {
    const enrolled = await prisma.training_enrollments.findFirst({
      where: {
        user_id: requester.userId,
        organization_id: program.organization_id,
        training_cohorts: { program_id: program.id },
        status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
      },
    });
    if (!enrolled) {
      throw new ApiError(403, 'COURSE_ENROLLMENT_REQUIRED', null, 'COURSE_ENROLLMENT_REQUIRED');
    }
    return { mode: 'learner', enrollment: enrolled };
  }
  if (isTrainerOnly(requester)) {
    await assertTrainerProgramAccess(requester, program.id);
  }
  return { mode: 'staff', enrollment: null };
}

function mapMaterial(m) {
  const meta = m.meta_json && typeof m.meta_json === 'object' ? m.meta_json : {};
  return {
    id: m.id,
    programId: m.program_id,
    organizationId: m.organization_id,
    title: m.title,
    description: m.description,
    materialType: m.material_type,
    url: m.url,
    storageKey: m.storage_key ? '[private]' : null,
    hasFile: Boolean(m.storage_key || m.file_id),
    fileId: m.file_id || null,
    mimeType: m.mime_type,
    durationSeconds: m.duration_seconds,
    availableFrom: m.available_from,
    isPublished: m.is_published,
    visibility: m.visibility,
    sortOrder: m.sort_order,
    cohortId: m.cohort_id,
    sessionId: m.session_id,
    meta,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    createdBy: m.created_by,
  };
}

function mapTask(t, submissionCount = 0) {
  const settings = t.settings_json && typeof t.settings_json === 'object' ? t.settings_json : {};
  return {
    id: t.id,
    programId: t.program_id,
    cohortId: t.cohort_id,
    title: t.title,
    instructions: t.instructions,
    maxScore: t.max_score,
    gradingMode: t.grading_mode,
    isFinalTask: t.is_final_task,
    isRequired: t.is_required,
    allowResubmit: t.allow_resubmit,
    maxAttempts: t.max_attempts,
    publishedAt: t.published_at,
    isPublished: Boolean(t.published_at),
    dueAt: t.due_at,
    settings,
    attachmentUrl: settings.attachmentUrl || null,
    hasAttachment: Boolean(settings.attachmentStorageKey || settings.attachmentFileId),
    externalLinks: Array.isArray(settings.externalLinks) ? settings.externalLinks : [],
    allowedFileTypes: Array.isArray(settings.allowedFileTypes) ? settings.allowedFileTypes : [],
    submissionCount,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

async function resolveManagerCanSeeDrafts(requester, programId) {
  if (isSystemWideAdmin(requester) || requester.roles?.includes('admin')) return true;
  if (!isTrainerOnly(requester)) return true;
  try {
    await assertTrainerProgramAccess(requester, programId, 'can_manage_materials');
    return true;
  } catch {
    return false;
  }
}

async function listProgramMaterials(requester, programId, options = {}) {
  const program = await loadProgramOrThrow(programId);
  const view = await assertCanViewProgramContent(requester, program);
  const canSeeDrafts = view.mode === 'staff' && (await resolveManagerCanSeeDrafts(requester, programId));
  const excludeLectures = options.excludeRecordedLectures !== false;
  const onlyLectures = Boolean(options.recordedLecturesOnly);
  const now = new Date();

  const rows = await prisma.training_materials.findMany({
    where: {
      program_id: programId,
      ...(onlyLectures
        ? { material_type: RECORDED_LECTURE_TYPE }
        : excludeLectures
          ? { NOT: { material_type: RECORDED_LECTURE_TYPE } }
          : {}),
      ...(!canSeeDrafts
        ? {
            is_published: true,
            OR: [{ available_from: null }, { available_from: { lte: now } }],
          }
        : {}),
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
  });
  return rows.map(mapMaterial);
}

async function createProgramMaterial(requester, programId, body = {}) {
  const program = await loadProgramOrThrow(programId);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, programId);

  const title = String(body.title || '').trim();
  if (!title) throw new ApiError(400, 'عنوان المادة مطلوب');

  const materialType = String(body.material_type || 'LINK').toUpperCase();
  if (materialType === RECORDED_LECTURE_TYPE) {
    throw new ApiError(400, 'استخدم واجهة المحاضرات المسجلة لإضافة محاضرة');
  }

  const url = body.url?.trim() || null;
  const storageKey = body.storage_key || null;
  const fileId = body.file_id || null;
  if (!url && !storageKey && !fileId) {
    throw new ApiError(400, 'يلزم ملف أو رابط خارجي للمادة التعليمية');
  }

  let resolvedStorageKey = storageKey;
  let resolvedMime = body.mime_type || null;
  let resolvedFileId = fileId;
  if (fileId && !resolvedStorageKey) {
    const file = await filesRepo.findById(fileId);
    if (!file) throw new ApiError(400, 'الملف غير موجود');
    resolvedStorageKey = file.storageKey;
    resolvedMime = resolvedMime || file.mimeType;
  }

  const row = await prisma.training_materials.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      cohort_id: body.cohort_id || null,
      session_id: body.session_id || null,
      title,
      description: body.description ?? null,
      material_type: EDUCATIONAL_TYPES.has(materialType)
        ? materialType
        : storageKey || fileId
          ? 'FILE'
          : 'LINK',
      url,
      storage_key: resolvedStorageKey,
      mime_type: resolvedMime,
      file_id: resolvedFileId,
      visibility: body.visibility || 'ENROLLED',
      is_published: body.is_published !== false,
      sort_order: Number(body.sort_order || 0),
      meta_json: body.meta && typeof body.meta === 'object' ? body.meta : undefined,
      created_by: requester.userId,
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'MATERIAL_CREATED',
    entityType: 'training_material',
    entityId: row.id,
    newValues: safeAuditValues({
      title: row.title,
      materialType: row.material_type,
      hasFile: Boolean(row.storage_key),
      hasUrl: Boolean(row.url),
      role: roleOf(requester),
      programId,
    }),
  });

  return mapMaterial(row);
}

async function softDeleteFile(fileId, requester) {
  if (!fileId) return;
  try {
    const filesService = require('../files/files.service');
    await filesService.deleteFile(fileId, { userId: requester.userId, isGlobal: true });
  } catch {
    /* keep successor file even if cleanup fails */
  }
}

async function updateProgramMaterial(requester, materialId, body = {}) {
  const existing = await prisma.training_materials.findUnique({ where: { id: materialId } });
  if (!existing || existing.material_type === RECORDED_LECTURE_TYPE) {
    throw new ApiError(404, 'المادة غير موجودة');
  }
  const program = await loadProgramOrThrow(existing.program_id);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, existing.program_id);

  const payload = body && typeof body === 'object' ? body : {};
  let nextStorageKey = existing.storage_key;
  let nextMime = existing.mime_type;
  let nextFileId = existing.file_id;
  let oldFileIdToDelete = null;
  let fileTouched = false;

  if (payload.file_id !== undefined || payload.storage_key !== undefined) {
    fileTouched = true;
    const newFileId = payload.file_id || null;
    const newStorageKey = payload.storage_key || null;
    if (newFileId || newStorageKey) {
      if (newFileId) {
        const file = await filesRepo.findById(newFileId);
        if (!file) throw new ApiError(400, 'الملف غير موجود');
        nextFileId = file.id;
        nextStorageKey = file.storageKey;
        nextMime = payload.mime_type || file.mimeType;
      } else {
        nextStorageKey = newStorageKey;
        nextFileId = null;
        nextMime = payload.mime_type || nextMime;
      }
      if (existing.file_id && existing.file_id !== nextFileId) oldFileIdToDelete = existing.file_id;
    }
  }

  const nextUrl = payload.url !== undefined ? payload.url?.trim() || null : existing.url;
  if (!nextUrl && !nextStorageKey && !nextFileId) {
    throw new ApiError(400, 'يلزم ملف أو رابط خارجي للمادة التعليمية');
  }

  const row = await prisma.training_materials.update({
    where: { id: materialId },
    data: {
      ...(payload.title !== undefined ? { title: String(payload.title).trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.material_type !== undefined && payload.material_type !== RECORDED_LECTURE_TYPE
        ? { material_type: String(payload.material_type).toUpperCase() }
        : {}),
      ...(payload.url !== undefined ? { url: nextUrl } : {}),
      ...(fileTouched ? { storage_key: nextStorageKey, file_id: nextFileId, mime_type: nextMime } : {}),
      ...(payload.visibility !== undefined ? { visibility: payload.visibility } : {}),
      ...(payload.is_published !== undefined ? { is_published: Boolean(payload.is_published) } : {}),
      ...(payload.sort_order !== undefined ? { sort_order: Number(payload.sort_order) } : {}),
      ...(payload.session_id !== undefined ? { session_id: payload.session_id || null } : {}),
      ...(payload.cohort_id !== undefined ? { cohort_id: payload.cohort_id || null } : {}),
      ...(payload.meta !== undefined ? { meta_json: payload.meta } : {}),
      updated_at: new Date(),
    },
  });

  await softDeleteFile(oldFileIdToDelete, requester);

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: fileTouched ? 'MATERIAL_FILE_REPLACED' : 'MATERIAL_UPDATED',
    entityType: 'training_material',
    entityId: row.id,
    oldValues: safeAuditValues({ title: existing.title, isPublished: existing.is_published }),
    newValues: safeAuditValues({
      title: row.title,
      isPublished: row.is_published,
      role: roleOf(requester),
      programId: program.id,
    }),
  });

  return mapMaterial(row);
}

async function deleteProgramMaterial(requester, materialId) {
  const existing = await prisma.training_materials.findUnique({ where: { id: materialId } });
  if (!existing || existing.material_type === RECORDED_LECTURE_TYPE) {
    throw new ApiError(404, 'المادة غير موجودة');
  }
  const program = await loadProgramOrThrow(existing.program_id);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, existing.program_id);

  await prisma.training_materials.delete({ where: { id: materialId } });
  await softDeleteFile(existing.file_id, requester);

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'MATERIAL_UPDATED',
    entityType: 'training_material',
    entityId: materialId,
    newValues: safeAuditValues({ deleted: true, role: roleOf(requester), programId: program.id }),
  });

  return { id: materialId, deleted: true };
}

async function listRecordedLectures(requester, programId) {
  return listProgramMaterials(requester, programId, {
    recordedLecturesOnly: true,
    excludeRecordedLectures: false,
  });
}

async function createRecordedLecture(requester, programId, body = {}) {
  const program = await loadProgramOrThrow(programId);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, programId);

  const title = String(body.title || '').trim();
  if (!title) throw new ApiError(400, 'عنوان المحاضرة مطلوب');

  const url = body.url?.trim() || body.external_url?.trim() || null;
  let resolvedStorageKey = body.storage_key || null;
  let resolvedMime = body.mime_type || null;
  let resolvedFileId = body.file_id || null;
  if (!url && !resolvedStorageKey && !resolvedFileId) {
    throw new ApiError(400, 'يلزم ملف محاضرة أو رابط فيديو');
  }
  if (resolvedFileId) {
    const file = await filesRepo.findById(resolvedFileId);
    if (!file) throw new ApiError(400, 'الملف غير موجود');
    resolvedStorageKey = file.storageKey;
    resolvedMime = resolvedMime || file.mimeType;
  }
  if (body.session_id) {
    const session = await prisma.training_sessions.findFirst({
      where: { id: body.session_id, training_cohorts: { program_id: programId } },
    });
    if (!session) throw new ApiError(400, 'الجلسة غير مرتبطة بهذه الدورة');
  }

  const row = await prisma.training_materials.create({
    data: {
      program_id: programId,
      organization_id: program.organization_id,
      session_id: body.session_id || null,
      cohort_id: body.cohort_id || null,
      title,
      description: body.description ?? null,
      material_type: RECORDED_LECTURE_TYPE,
      url,
      storage_key: resolvedStorageKey,
      mime_type: resolvedMime,
      file_id: resolvedFileId,
      duration_seconds:
        body.duration_seconds != null && body.duration_seconds !== ''
          ? Number(body.duration_seconds)
          : null,
      available_from: body.available_from ? new Date(body.available_from) : null,
      visibility: body.visibility || 'ENROLLED',
      is_published: body.is_published === true || body.publish === true,
      sort_order: Number(body.sort_order || 0),
      meta_json: {
        ...(body.meta && typeof body.meta === 'object' ? body.meta : {}),
        thumbnailUrl: body.thumbnail_url || null,
      },
      created_by: requester.userId,
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'RECORDED_LECTURE_CREATED',
    entityType: 'training_recorded_lecture',
    entityId: row.id,
    newValues: safeAuditValues({
      title: row.title,
      hasFile: Boolean(row.storage_key),
      sessionId: row.session_id,
      isPublished: row.is_published,
      role: roleOf(requester),
      programId,
    }),
  });

  return mapMaterial(row);
}

async function updateRecordedLecture(requester, lectureId, body = {}) {
  const existing = await prisma.training_materials.findUnique({ where: { id: lectureId } });
  if (!existing || existing.material_type !== RECORDED_LECTURE_TYPE) {
    throw new ApiError(404, 'المحاضرة غير موجودة');
  }
  const program = await loadProgramOrThrow(existing.program_id);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, existing.program_id);

  const payload = body && typeof body === 'object' ? body : {};
  let nextStorageKey = existing.storage_key;
  let nextMime = existing.mime_type;
  let nextFileId = existing.file_id;
  let oldFileIdToDelete = null;
  let fileReplaced = false;

  if (payload.file_id !== undefined || payload.storage_key !== undefined) {
    const newFileId = payload.file_id || null;
    const newStorageKey = payload.storage_key || null;
    if (newFileId || newStorageKey) {
      fileReplaced = true;
      if (newFileId) {
        const file = await filesRepo.findById(newFileId);
        if (!file) throw new ApiError(400, 'الملف غير موجود');
        nextFileId = file.id;
        nextStorageKey = file.storageKey;
        nextMime = payload.mime_type || file.mimeType;
      } else {
        nextStorageKey = newStorageKey;
        nextFileId = null;
        nextMime = payload.mime_type || nextMime;
      }
      if (existing.file_id && existing.file_id !== nextFileId) oldFileIdToDelete = existing.file_id;
    }
  }

  if (payload.session_id) {
    const session = await prisma.training_sessions.findFirst({
      where: { id: payload.session_id, training_cohorts: { program_id: program.id } },
    });
    if (!session) throw new ApiError(400, 'الجلسة غير مرتبطة بهذه الدورة');
  }

  const nextUrl =
    payload.url !== undefined
      ? payload.url?.trim() || null
      : payload.external_url !== undefined
        ? payload.external_url?.trim() || null
        : existing.url;
  if (!nextUrl && !nextStorageKey && !nextFileId) {
    throw new ApiError(400, 'يلزم ملف محاضرة أو رابط فيديو');
  }

  const prevMeta = existing.meta_json && typeof existing.meta_json === 'object' ? existing.meta_json : {};
  const row = await prisma.training_materials.update({
    where: { id: lectureId },
    data: {
      ...(payload.title !== undefined ? { title: String(payload.title).trim() } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.url !== undefined || payload.external_url !== undefined ? { url: nextUrl } : {}),
      ...(fileReplaced
        ? { storage_key: nextStorageKey, file_id: nextFileId, mime_type: nextMime }
        : {}),
      ...(payload.duration_seconds !== undefined
        ? {
            duration_seconds:
              payload.duration_seconds != null && payload.duration_seconds !== ''
                ? Number(payload.duration_seconds)
                : null,
          }
        : {}),
      ...(payload.available_from !== undefined
        ? { available_from: payload.available_from ? new Date(payload.available_from) : null }
        : {}),
      ...(payload.visibility !== undefined ? { visibility: payload.visibility } : {}),
      ...(payload.is_published !== undefined ? { is_published: Boolean(payload.is_published) } : {}),
      ...(payload.sort_order !== undefined ? { sort_order: Number(payload.sort_order) } : {}),
      ...(payload.session_id !== undefined ? { session_id: payload.session_id || null } : {}),
      ...(payload.cohort_id !== undefined ? { cohort_id: payload.cohort_id || null } : {}),
      ...(payload.meta !== undefined || payload.thumbnail_url !== undefined
        ? {
            meta_json: {
              ...prevMeta,
              ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
              ...(payload.thumbnail_url !== undefined ? { thumbnailUrl: payload.thumbnail_url } : {}),
            },
          }
        : {}),
      updated_at: new Date(),
    },
  });

  await softDeleteFile(oldFileIdToDelete, requester);

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: fileReplaced ? 'RECORDED_LECTURE_FILE_REPLACED' : 'RECORDED_LECTURE_UPDATED',
    entityType: 'training_recorded_lecture',
    entityId: row.id,
    oldValues: safeAuditValues({
      title: existing.title,
      isPublished: existing.is_published,
      sessionId: existing.session_id,
    }),
    newValues: safeAuditValues({
      title: row.title,
      isPublished: row.is_published,
      sessionId: row.session_id,
      role: roleOf(requester),
      programId: program.id,
    }),
  });

  return mapMaterial(row);
}

async function publishRecordedLecture(requester, lectureId, publish = true) {
  const existing = await prisma.training_materials.findUnique({ where: { id: lectureId } });
  if (!existing || existing.material_type !== RECORDED_LECTURE_TYPE) {
    throw new ApiError(404, 'المحاضرة غير موجودة');
  }
  const program = await loadProgramOrThrow(existing.program_id);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, existing.program_id);

  const row = await prisma.training_materials.update({
    where: { id: lectureId },
    data: { is_published: Boolean(publish), updated_at: new Date() },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: publish ? 'RECORDED_LECTURE_PUBLISHED' : 'RECORDED_LECTURE_UNPUBLISHED',
    entityType: 'training_recorded_lecture',
    entityId: row.id,
    newValues: safeAuditValues({
      isPublished: row.is_published,
      role: roleOf(requester),
      programId: program.id,
    }),
  });

  return mapMaterial(row);
}

async function deleteRecordedLecture(requester, lectureId) {
  const existing = await prisma.training_materials.findUnique({ where: { id: lectureId } });
  if (!existing || existing.material_type !== RECORDED_LECTURE_TYPE) {
    throw new ApiError(404, 'المحاضرة غير موجودة');
  }
  const program = await loadProgramOrThrow(existing.program_id);
  assertOrganizationAccess(requester, program.organization_id);
  await assertManageMaterials(requester, existing.program_id);

  await prisma.training_materials.delete({ where: { id: lectureId } });
  await softDeleteFile(existing.file_id, requester);

  await recordAudit({
    userId: requester.userId,
    organizationId: program.organization_id,
    actionType: 'RECORDED_LECTURE_UPDATED',
    entityType: 'training_recorded_lecture',
    entityId: lectureId,
    newValues: safeAuditValues({ deleted: true, role: roleOf(requester), programId: program.id }),
  });

  return { id: lectureId, deleted: true };
}

async function getMaterialPlaybackUrl(requester, materialId) {
  const material = await prisma.training_materials.findUnique({ where: { id: materialId } });
  if (!material) throw new ApiError(404, 'المحتوى غير موجود');
  const program = await loadProgramOrThrow(material.program_id);
  const view = await assertCanViewProgramContent(requester, program);

  if (view.mode === 'learner') {
    if (!material.is_published) {
      throw new ApiError(403, 'المحاضرة غير منشورة', null, 'LECTURE_NOT_PUBLISHED');
    }
    if (material.available_from && new Date(material.available_from) > new Date()) {
      throw new ApiError(403, 'المحاضرة غير متاحة بعد', null, 'LECTURE_NOT_AVAILABLE');
    }
  }

  if (material.url && !material.storage_key && !material.file_id) {
    return { url: material.url, expiresIn: null, source: 'external' };
  }

  let file = null;
  if (material.file_id) file = await filesRepo.findById(material.file_id);
  if (!file && material.storage_key) file = await filesRepo.findByStorageKey(material.storage_key);
  if (!file && !material.storage_key) throw new ApiError(404, 'ملف المحاضرة غير موجود');

  if (file?.visibility === 'public' && file.url) {
    return { url: file.url, expiresIn: null, source: 'public' };
  }

  const storageKey = file?.storageKey || material.storage_key;
  if (getStorageBackend() === 'local') {
    return {
      url: resolvePublicUrl(storageKey),
      expiresIn: null,
      source: 'local',
      mimeType: file?.mimeType || material.mime_type,
    };
  }

  const provider = getProvider();
  const signed = await provider.createPresignedGetUrl({ storageKey });
  return {
    url: signed.url || signed.downloadUrl || signed,
    expiresIn: signed.expiresIn || null,
    source: 'signed',
    mimeType: file?.mimeType || material.mime_type,
  };
}

async function listProgramTasksDetailed(requester, programId) {
  const program = await loadProgramOrThrow(programId);
  assertOrganizationAccess(requester, program.organization_id);
  await assertTrainerProgramAccess(requester, programId, 'can_manage_tasks');

  const rows = await prisma.training_tasks.findMany({
    where: { program_id: programId },
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { training_task_submissions: true } } },
  });
  return rows.map((r) => mapTask(r, r._count?.training_task_submissions || 0));
}

async function updateTask(requester, taskId, body = {}) {
  const existing = await prisma.training_tasks.findUnique({
    where: { id: taskId },
    include: {
      training_programs: true,
      _count: { select: { training_task_submissions: true } },
    },
  });
  if (!existing) throw new ApiError(404, 'المهمة غير موجودة');
  assertOrganizationAccess(requester, existing.training_programs.organization_id);
  await assertManageTasks(requester, existing.program_id);

  const payload = body && typeof body === 'object' ? body : {};
  const submissionCount = existing._count?.training_task_submissions || 0;
  const significant =
    (payload.title !== undefined && payload.title !== existing.title) ||
    (payload.instructions !== undefined && payload.instructions !== existing.instructions) ||
    (payload.max_score !== undefined && Number(payload.max_score) !== Number(existing.max_score)) ||
    (payload.due_at !== undefined && String(payload.due_at || '') !== String(existing.due_at || ''));

  if (significant && submissionCount > 0 && !payload.acknowledge_submissions_impact) {
    throw new ApiError(
      409,
      'توجد تسليمات سابقة لهذه المهمة. أكّد التعديل مع acknowledge_submissions_impact=true دون حذف التسليمات.',
      {
        submissionCount,
        warning: 'تعديل المهمة قد يؤثر على المتدربين دون حذف التسليمات التاريخية.',
      },
      'TASK_HAS_SUBMISSIONS'
    );
  }

  const prevSettings =
    existing.settings_json && typeof existing.settings_json === 'object' ? existing.settings_json : {};
  const nextSettings = { ...prevSettings };
  if (payload.external_links !== undefined) {
    nextSettings.externalLinks = Array.isArray(payload.external_links) ? payload.external_links : [];
  }
  if (payload.allowed_file_types !== undefined) {
    nextSettings.allowedFileTypes = Array.isArray(payload.allowed_file_types)
      ? payload.allowed_file_types
      : [];
  }
  if (payload.attachment_url !== undefined) nextSettings.attachmentUrl = payload.attachment_url || null;
  if (payload.attachment_storage_key !== undefined) {
    nextSettings.attachmentStorageKey = payload.attachment_storage_key || null;
  }
  if (payload.attachment_file_id !== undefined) {
    nextSettings.attachmentFileId = payload.attachment_file_id || null;
  }
  if (payload.settings !== undefined && typeof payload.settings === 'object') {
    Object.assign(nextSettings, payload.settings);
  }

  let publishedAt = existing.published_at;
  if (payload.publish === true) publishedAt = existing.published_at || new Date();
  if (payload.unpublish === true || payload.publish === false) publishedAt = null;
  if (payload.published_at !== undefined) {
    publishedAt = payload.published_at ? new Date(payload.published_at) : null;
  }

  const row = await prisma.training_tasks.update({
    where: { id: taskId },
    data: {
      ...(payload.title !== undefined ? { title: String(payload.title).trim() } : {}),
      ...(payload.instructions !== undefined ? { instructions: payload.instructions } : {}),
      ...(payload.max_score !== undefined ? { max_score: payload.max_score } : {}),
      ...(payload.grading_mode !== undefined ? { grading_mode: payload.grading_mode } : {}),
      ...(payload.is_final_task !== undefined ? { is_final_task: Boolean(payload.is_final_task) } : {}),
      ...(payload.is_required !== undefined ? { is_required: Boolean(payload.is_required) } : {}),
      ...(payload.allow_resubmit !== undefined ? { allow_resubmit: Boolean(payload.allow_resubmit) } : {}),
      ...(payload.max_attempts !== undefined ? { max_attempts: Number(payload.max_attempts) } : {}),
      ...(payload.due_at !== undefined ? { due_at: payload.due_at ? new Date(payload.due_at) : null } : {}),
      ...(payload.cohort_id !== undefined ? { cohort_id: payload.cohort_id || null } : {}),
      published_at: publishedAt,
      settings_json: nextSettings,
      updated_at: new Date(),
    },
  });

  await recordAudit({
    userId: requester.userId,
    organizationId: existing.training_programs.organization_id,
    actionType: 'TASK_UPDATED',
    entityType: 'training_task',
    entityId: row.id,
    oldValues: safeAuditValues({
      title: existing.title,
      dueAt: existing.due_at,
      publishedAt: existing.published_at,
    }),
    newValues: safeAuditValues({
      title: row.title,
      dueAt: row.due_at,
      publishedAt: row.published_at,
      role: roleOf(requester),
      programId: existing.program_id,
      submissionCount,
    }),
  });

  return mapTask(row, submissionCount);
}

module.exports = {
  RECORDED_LECTURE_TYPE,
  listProgramMaterials,
  createProgramMaterial,
  updateProgramMaterial,
  deleteProgramMaterial,
  listRecordedLectures,
  createRecordedLecture,
  updateRecordedLecture,
  publishRecordedLecture,
  deleteRecordedLecture,
  getMaterialPlaybackUrl,
  listProgramTasksDetailed,
  updateTask,
  mapMaterial,
  mapTask,
};
