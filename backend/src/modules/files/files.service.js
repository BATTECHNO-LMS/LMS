const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { getProvider, getStorageBackend } = require('../../shared/storage/storageProvider');
const {
  validateUploadRequest,
  buildStorageKey,
  assertSafeStorageKey,
  getMaxBytesForMime,
} = require('../../shared/storage/fileRules');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const repo = require('./files.repository');

function canAccessFile(file, user) {
  if (!file || !user) return false;
  if (user.isGlobal) return true;
  if (file.createdById && file.createdById === user.userId) return true;
  if (file.userId && file.userId === user.userId) return true;
  return false;
}

async function presignUpload(body, user) {
  const validation = validateUploadRequest(body);
  if (!validation.valid) {
    throw new ApiError(400, validation.errors[0] || 'Invalid upload request', null, 'FILE_VALIDATION_ERROR');
  }

  const provider = getProvider();
  const storageKey = buildStorageKey(validation.folder, body.fileName);
  assertSafeStorageKey(storageKey);

  let presigned;
  try {
    presigned = await provider.createPresignedPutUrl({
      storageKey,
      mimeType: validation.mimeType,
    });
  } catch (err) {
    if (getStorageBackend() === 'local') {
      throw new ApiError(
        503,
        'Presigned uploads require STORAGE_BACKEND=r2',
        null,
        'STORAGE_NOT_CONFIGURED'
      );
    }
    throw new ApiError(503, 'تعذّر تجهيز رابط الرفع. حاول لاحقًا.', null, 'STORAGE_PROVIDER_ERROR');
  }

  return {
    uploadUrl: presigned.uploadUrl,
    storageKey,
    bucket: presigned.bucket,
    expiresIn: presigned.expiresIn,
    requiredHeaders: presigned.requiredHeaders,
    visibility: body.visibility || 'private',
    relatedEntityType: body.relatedEntityType ?? null,
    relatedEntityId: body.relatedEntityId ?? null,
    createdById: user.userId,
  };
}

async function confirmUpload(body, user) {
  const storageKey = assertSafeStorageKey(body.storageKey);
  const mimeType = String(body.mimeType || '').trim().toLowerCase();
  const size = Number(body.size);

  if (size > getMaxBytesForMime(mimeType)) {
    throw new ApiError(400, 'حجم الملف يتجاوز الحد المسموح', null, 'FILE_TOO_LARGE');
  }

  const provider = getProvider();
  const head = await provider.headObject(storageKey);
  if (!head) {
    throw new ApiError(400, 'لم يُعثر على الملف في التخزين. أعد الرفع.', null, 'FILE_NOT_FOUND');
  }

  if (head.size > 0 && size > 0 && Math.abs(head.size - size) > 1024) {
    throw new ApiError(400, 'حجم الملف لا يطابق الملف المرفوع', null, 'FILE_SIZE_MISMATCH');
  }

  const existing = await repo.findByStorageKey(storageKey);
  if (existing) {
    return existing;
  }

  const bucket =
    getStorageBackend() === 'r2' ? env.R2_BUCKET_NAME : env.UPLOAD_DIR || 'uploads';
  const visibility = body.visibility === 'public' ? 'public' : 'private';
  const url =
    visibility === 'public' ? resolvePublicUrl(storageKey) : null;

  return repo.createFile({
    userId: user.userId,
    createdById: user.userId,
    relatedEntityType: body.relatedEntityType ?? null,
    relatedEntityId: body.relatedEntityId ?? null,
    originalName: body.originalName,
    storageKey,
    bucket,
    mimeType,
    size: head.size || size,
    visibility,
    url,
  });
}

async function getDownloadUrl(fileId, user) {
  const file = await repo.findById(fileId);
  if (!file) throw new ApiError(404, 'File not found');
  if (!canAccessFile(file, user)) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى هذا الملف', null, 'FILE_FORBIDDEN');
  }

  if (file.visibility === 'public' && file.url) {
    return { url: file.url, expiresIn: null };
  }

  const provider = getProvider();
  if (getStorageBackend() === 'local') {
    const publicUrl = resolvePublicUrl(file.storageKey);
    return { url: publicUrl, expiresIn: null };
  }

  const signed = await provider.createPresignedGetUrl({ storageKey: file.storageKey });
  return signed;
}

async function deleteFile(fileId, user) {
  const file = await repo.findById(fileId);
  if (!file) throw new ApiError(404, 'File not found');
  if (!canAccessFile(file, user)) {
    throw new ApiError(403, 'غير مصرح بحذف هذا الملف', null, 'FILE_FORBIDDEN');
  }

  const provider = getProvider();
  if (getStorageBackend() === 'r2') {
    try {
      await provider.deleteObject(file.storageKey);
    } catch {
      /* soft-delete DB even if object delete fails */
    }
  } else {
    try {
      await provider.deleteObject(file.storageKey);
    } catch {
      /* ignore */
    }
  }

  return repo.softDelete(fileId);
}

async function getFileByIdForUser(fileId, user) {
  const file = await repo.findById(fileId);
  if (!file) throw new ApiError(404, 'File not found');
  if (!canAccessFile(file, user)) {
    throw new ApiError(403, 'غير مصرح بالوصول إلى هذا الملف', null, 'FILE_FORBIDDEN');
  }
  return file;
}

async function checkStorageHealth() {
  const provider = getProvider();
  return provider.checkHealth();
}

/**
 * Resolve multer file or confirmed fileId into a normalized upload descriptor.
 * @param {{ file?: Express.Multer.File, fileId?: string, localPathBuilder?: (file: Express.Multer.File) => string }} input
 * @param {{ userId: string, isGlobal?: boolean }} user
 */
async function resolveUploadInput(input, user) {
  const { file, fileId, localPathBuilder } = input || {};
  if (fileId) {
    const record = await getFileByIdForUser(fileId, user);
    return {
      filePath: record.storageKey,
      fileName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      fileId: record.id,
    };
  }
  if (file) {
    const filePath = localPathBuilder ? localPathBuilder(file) : file.path;
    return {
      filePath: String(filePath).replace(/\\/g, '/'),
      fileName: file.originalname || file.filename,
      mimeType: file.mimetype,
      size: file.size,
      fileId: null,
    };
  }
  return null;
}

module.exports = {
  presignUpload,
  confirmUpload,
  getDownloadUrl,
  deleteFile,
  getFileByIdForUser,
  canAccessFile,
  checkStorageHealth,
  resolveUploadInput,
};
