import { withUploadAccessToken } from '../../utils/protectedUploadUrl.js';

/**
 * Open a remote download URL in a new browser tab (avoids XHR/CORS on R2 presigned URLs).
 * Same-origin /uploads paths get an access_token query so authenticate middleware accepts them.
 * @param {string} url
 */
export function openRemoteDownloadUrl(url) {
  window.open(withUploadAccessToken(url), '_blank', 'noopener,noreferrer');
}

/**
 * Trigger browser download for an authenticated field training submission blob.
 * Uses a temporary object URL — never navigates to a protected API URL.
 * @param {{ blob: Blob; filename: string }} file
 */
export function saveFieldTrainingSubmissionBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so Chrome/Safari can start the download before the blob URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function parseFilename(contentDisposition, fallback) {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition || '');
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      /* use quoted filename */
    }
  }
  const match = /filename="([^"]+)"/i.exec(contentDisposition || '');
  return match?.[1] ?? fallback;
}

/**
 * When Axios uses responseType:'blob', JSON error bodies arrive as Blobs.
 * Parse them back onto err.response.data so getApiErrorMessage works.
 */
export async function rethrowBlobApiError(err) {
  const data = err?.response?.data;
  if (data && typeof data.text === 'function') {
    try {
      const parsed = JSON.parse(await data.text());
      err.response.data = parsed;
    } catch {
      /* keep original blob — never show [object Blob] */
      if (data instanceof Blob) {
        err.response.data = {
          success: false,
          message: null,
          code: 'BLOB_ERROR',
        };
      }
    }
  }
  throw err;
}

/**
 * Guard against proxies/misconfigurations that return JSON with HTTP 200
 * while Axios was expecting a binary download.
 * @param {import('axios').AxiosResponse} res
 */
export async function assertBlobDownloadSuccess(res) {
  const data = res?.data;
  const contentType = String(res?.headers?.['content-type'] || data?.type || '').toLowerCase();
  const looksJson =
    contentType.includes('application/json') ||
    contentType.includes('text/json') ||
    contentType.includes('text/plain');
  if (!(data instanceof Blob) || !looksJson) return res;

  let parsed;
  try {
    parsed = JSON.parse(await data.text());
  } catch {
    return res;
  }
  const code = String(parsed?.code || '');
  let status = Number(parsed?.statusCode || parsed?.status || 0);
  if (!status || status < 400) {
    if (code === 'UNAUTHORIZED' || code === 'TOKEN_INVALID' || code === 'PORTAL_REQUIRED') {
      status = 401;
    } else if (code === 'FORBIDDEN' || code === 'PORTAL_MISMATCH' || code === 'FIELD_TRAINING_FORBIDDEN') {
      status = 403;
    } else {
      status = Number(res.status) >= 400 ? Number(res.status) : 400;
    }
  }
  const error = new Error(parsed?.message || 'Download failed');
  error.response = {
    status,
    data: parsed,
    headers: res.headers,
  };
  error.config = res.config;
  throw error;
}

export const saveCompletionLetterBlob = saveFieldTrainingSubmissionBlob;

export const STUDENTS_EXCEL_EMPTY_CODE = 'FIELD_TRAINING_STUDENTS_EXPORT_EMPTY';

export function studentsExcelErrorMessage(err, t, fallback) {
  const code = err?.response?.data?.code || err?.code;
  if (code === STUDENTS_EXCEL_EMPTY_CODE) {
    return t('studentsExcel.empty');
  }
  return fallback || err?.response?.data?.message || t('studentsExcel.failed');
}
