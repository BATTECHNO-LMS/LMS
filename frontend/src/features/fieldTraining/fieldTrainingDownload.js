/**
 * Open a remote download URL in a new browser tab (avoids XHR/CORS on R2 presigned URLs).
 * @param {string} url
 */
export function openRemoteDownloadUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Trigger browser download for an authenticated field training submission blob.
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
  URL.revokeObjectURL(url);
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

export async function rethrowBlobApiError(err) {
  const data = err?.response?.data;
  if (data && typeof data.text === 'function') {
    try {
      const parsed = JSON.parse(await data.text());
      err.response.data = parsed;
    } catch {
      /* keep original blob */
    }
  }
  throw err;
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
