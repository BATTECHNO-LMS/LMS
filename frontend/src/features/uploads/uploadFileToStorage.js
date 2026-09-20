import { endpoints } from '../../services/endpoints.js';
import { storageKeys, getStorageItem } from '../../utils/storage.js';
import { triggerUnauthorized } from '../../services/authSessionBridge.js';
import { validateFileForUpload } from './uploadRules.js';

function mapUploadError(err) {
  const code = err?.response?.data?.code || err?.code;
  if (code === 'FILE_VALIDATION_ERROR' || code === 'FILE_TOO_LARGE') return 'TOO_LARGE';
  if (code === 'FILE_UPLOAD_RATE_LIMIT') return 'RATE_LIMIT';
  if (code === 'STORAGE_NOT_CONFIGURED' || code === 'STORAGE_PROVIDER_ERROR') return 'STORAGE';
  if (code === 'FILE_NOT_FOUND') return 'CONFIRM_FAILED';
  if (err?.message?.includes('Network Error') || err?.message?.includes('CORS')) return 'CORS';
  if (err?.status === 403 || err?.response?.status === 403) return 'UNAUTHORIZED';
  return 'UPLOAD_FAILED';
}

/**
 * Upload file through the API (same-origin). Avoids browser PUT to R2, which
 * requires bucket CORS that the object-storage token cannot update.
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

  const formData = new FormData();
  formData.append('folder', options.folder);
  formData.append('visibility', options.visibility || 'private');
  if (options.relatedEntityType) {
    formData.append('relatedEntityType', options.relatedEntityType);
  }
  if (options.relatedEntityId) {
    formData.append('relatedEntityId', options.relatedEntityId);
  }
  formData.append('file', file);

  try {
    return await postFileWithProgress(formData, options.onProgress);
  } catch (err) {
    err.code = err.code || mapUploadError(err);
    throw err;
  }
}

function postFileWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
    xhr.open('POST', `${baseURL}${endpoints.files.upload}`, true);
    xhr.timeout = 10 * 60 * 1000;

    const token = getStorageItem(storageKeys.authToken);
    if (token && typeof token === 'string') {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      let body = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }

      if (xhr.status === 401) {
        triggerUnauthorized();
        const err = new Error(body?.message || 'UNAUTHORIZED');
        err.code = 'UNAUTHORIZED';
        err.status = 401;
        reject(err);
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body?.success !== false) {
        onProgress?.(100);
        resolve(body?.data ?? body);
        return;
      }

      const err = new Error(body?.message || 'UPLOAD_FAILED');
      err.code = body?.code || (xhr.status === 403 ? 'UNAUTHORIZED' : 'UPLOAD_FAILED');
      err.status = xhr.status;
      err.response = { status: xhr.status, data: body };
      reject(err);
    };

    xhr.onerror = () => {
      const err = new Error('CORS');
      err.code = 'CORS';
      reject(err);
    };

    xhr.ontimeout = () => {
      const err = new Error('UPLOAD_FAILED');
      err.code = 'UPLOAD_FAILED';
      reject(err);
    };

    xhr.send(formData);
  });
}

export { mapUploadError };
