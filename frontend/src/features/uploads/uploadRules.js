export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

export const ALLOWED_MIME_TYPES = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const MAX_GENERAL_BYTES = 100 * 1024 * 1024;

export function getMaxBytesForMime(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (IMAGE_MIME_TYPES.includes(mime)) return MAX_IMAGE_BYTES;
  if (DOCUMENT_MIME_TYPES.includes(mime)) return MAX_DOCUMENT_BYTES;
  return MAX_GENERAL_BYTES;
}

export function formatMaxSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * @param {File} file
 * @param {{ accept?: string[], maxBytes?: number }} [options]
 */
export function validateFileForUpload(file, options = {}) {
  if (!file) return { valid: false, code: 'FILE_REQUIRED' };
  const mime = String(file.type || '').toLowerCase();
  const accept = options.accept?.length ? options.accept : ALLOWED_MIME_TYPES;
  if (!accept.includes(mime)) return { valid: false, code: 'INVALID_TYPE' };
  const maxBytes = options.maxBytes ?? getMaxBytesForMime(mime);
  if (file.size > maxBytes) return { valid: false, code: 'TOO_LARGE', maxBytes };
  return { valid: true, mime, maxBytes };
}
