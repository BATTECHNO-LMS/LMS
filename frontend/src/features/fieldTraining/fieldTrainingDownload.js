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

export const saveCompletionLetterBlob = saveFieldTrainingSubmissionBlob;
