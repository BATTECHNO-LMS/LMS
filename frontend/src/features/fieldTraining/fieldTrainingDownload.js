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
