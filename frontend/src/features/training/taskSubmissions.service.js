import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';
import { storageKeys, getStorageItem } from '../../utils/storage.js';
import { triggerUnauthorized } from '../../services/authSessionBridge.js';
import {
  assertBlobDownloadSuccess,
  parseFilename,
  rethrowBlobApiError,
  saveFieldTrainingSubmissionBlob,
} from '../fieldTraining/fieldTrainingDownload.js';
import { TASK_UPLOAD_ERROR_MESSAGES } from './taskSubmissionLimits.js';

const base = endpoints.training;

function uploadError(code, message, status) {
  const err = new Error(message || TASK_UPLOAD_ERROR_MESSAGES[code] || TASK_UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Upload one attachment as a submission draft with real progress.
 * @param {string} taskId
 * @param {File} file
 * @param {{ onProgress?: (percent: number) => void }} [options]
 * @returns {{ promise: Promise<{ id: string, originalName: string, size: number, mimeType: string }>, abort: () => void }}
 */
export function uploadTaskSubmissionFile(taskId, file, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
    xhr.open('POST', `${baseURL}${base}/tasks/${taskId}/submission-files`, true);
    xhr.timeout = 30 * 60 * 1000;
    const token = getStorageItem(storageKeys.authToken);
    if (token && typeof token === 'string') xhr.setRequestHeader('Authorization', `Bearer ${token}`);

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
        reject(uploadError('UNAUTHORIZED', null, 401));
        return;
      }
      if (xhr.status === 413) {
        reject(uploadError('FILE_TOO_LARGE', body?.message, 413));
        return;
      }
      if (xhr.status === 429) {
        reject(uploadError('RATE_LIMIT', body?.message, 429));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.success !== false) {
        onProgress?.(100);
        resolve(body?.data ?? body);
        return;
      }
      const code = body?.code || 'UPLOAD_FAILED';
      const safeMessage = /[\u0600-\u06FF]/.test(body?.message || '') ? body.message : null;
      reject(uploadError(code, safeMessage, xhr.status));
    };
    xhr.onerror = () => reject(uploadError('NETWORK'));
    xhr.ontimeout = () => reject(uploadError('NETWORK'));
    xhr.onabort = () => reject(uploadError('ABORTED', 'تم إلغاء الرفع.'));

    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export async function listTaskSubmissionDrafts(taskId) {
  const res = await apiClient.get(`${base}/tasks/${taskId}/submission-files`);
  const data = unwrapApiData(res);
  return Array.isArray(data) ? data : [];
}

export async function deleteTaskSubmissionDraft(taskId, fileId) {
  const res = await apiClient.delete(`${base}/tasks/${taskId}/submission-files/${fileId}`);
  return unwrapApiData(res);
}

export async function submitTaskWithFiles(taskId, { contentText, fileIds }) {
  const res = await apiClient.post(`${base}/tasks/${taskId}/submissions`, {
    content_text: contentText || '',
    file_ids: fileIds || [],
  });
  return unwrapApiData(res);
}

async function downloadBlob(url, fallbackName) {
  try {
    const res = await apiClient.get(url, { responseType: 'blob' });
    await assertBlobDownloadSuccess(res);
    const filename = parseFilename(res.headers?.['content-disposition'], fallbackName || 'file');
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return { filename };
  } catch (err) {
    return rethrowBlobApiError(err);
  }
}

export function downloadTaskSubmissionFile(submissionId, fileId, fileName) {
  return downloadBlob(`${base}/task-submissions/${submissionId}/files/${fileId}/download`, fileName);
}

export async function downloadLegacyTaskSubmissionFile(submissionId) {
  const url = `${base}/task-submissions/${submissionId}/legacy-file/download`;
  try {
    const res = await apiClient.get(url, { responseType: 'blob' });
    const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(await res.data.text());
      const externalUrl = parsed?.data?.externalUrl;
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        return { external: true };
      }
      await assertBlobDownloadSuccess(res);
    }
    const filename = parseFilename(res.headers?.['content-disposition'], 'submission-file');
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return { filename };
  } catch (err) {
    return rethrowBlobApiError(err);
  }
}

export async function listTaskSubmissionsForReview(taskId) {
  const res = await apiClient.get(`${base}/tasks/${taskId}/submissions`);
  const data = unwrapApiData(res);
  return Array.isArray(data) ? data : [];
}

export async function gradeTaskSubmission(submissionId, body) {
  const res = await apiClient.post(`${base}/submissions/${submissionId}/grade`, body);
  return unwrapApiData(res);
}

export async function requestTaskSubmissionRevision(submissionId, feedback) {
  const res = await apiClient.post(`${base}/submissions/${submissionId}/revision`, { feedback });
  return unwrapApiData(res);
}
