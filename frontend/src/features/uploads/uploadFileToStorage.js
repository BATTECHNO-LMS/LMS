import { presignUpload, confirmUpload } from './files.service.js';
import { validateFileForUpload } from './uploadRules.js';

function mapUploadError(err) {
  const code = err?.response?.data?.code;
  if (code === 'FILE_VALIDATION_ERROR' || code === 'FILE_TOO_LARGE') return 'TOO_LARGE';
  if (code === 'FILE_UPLOAD_RATE_LIMIT') return 'RATE_LIMIT';
  if (code === 'STORAGE_NOT_CONFIGURED' || code === 'STORAGE_PROVIDER_ERROR') return 'STORAGE';
  if (code === 'FILE_NOT_FOUND') return 'CONFIRM_FAILED';
  if (err?.message?.includes('Network Error') || err?.message?.includes('CORS')) return 'CORS';
  if (err?.status === 403 || err?.response?.status === 403) return 'UNAUTHORIZED';
  return 'UPLOAD_FAILED';
}

/**
 * Upload file via presigned URL flow.
 * @param {File} file
 * @param {{
 *   folder: string,
 *   visibility?: 'public' | 'private',
 *   relatedEntityType?: string,
 *   relatedEntityId?: string,
 *   accept?: string[],
 *   maxBytes?: number,
 *   onProgress?: (percent: number) => void,
 * }} options
 */
export async function uploadFileToStorage(file, options) {
  const validation = validateFileForUpload(file, {
    accept: options.accept,
    maxBytes: options.maxBytes,
  });
  if (!validation.valid) {
    const err = new Error(validation.code);
    err.code = validation.code;
    throw err;
  }

  const presign = await presignUpload({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    folder: options.folder,
    visibility: options.visibility || 'private',
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
  });

  await putFileWithProgress(presign.uploadUrl, file, presign.requiredHeaders, options.onProgress);

  try {
    const record = await confirmUpload({
      storageKey: presign.storageKey,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      visibility: options.visibility || 'private',
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: options.relatedEntityId,
    });
    return record;
  } catch (err) {
    err.code = mapUploadError(err);
    throw err;
  }
}

function putFileWithProgress(uploadUrl, file, requiredHeaders = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    Object.entries(requiredHeaders || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    if (!requiredHeaders?.['Content-Type'] && file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      const err = new Error('UPLOAD_FAILED');
      err.code = xhr.status === 403 ? 'EXPIRED_URL' : 'UPLOAD_FAILED';
      reject(err);
    };

    xhr.onerror = () => {
      const err = new Error('CORS');
      err.code = 'CORS';
      reject(err);
    };

    xhr.send(file);
  });
}

export { mapUploadError };
