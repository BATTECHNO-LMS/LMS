const path = require('path');
const crypto = require('crypto');

const ALLOWED_FOLDERS = Object.freeze([
  'users',
  'training',
  'certificates',
  'invoices',
  'articles',
  'logos',
  'general',
]);

const IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DOCUMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/x-markdown',
  'application/rtf',
  'text/rtf',
]);

const ARCHIVE_MIME_TYPES = Object.freeze([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
]);

const MEDIA_MIME_TYPES = Object.freeze([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
]);

const CODE_MIME_TYPES = Object.freeze([
  'application/javascript',
  'text/javascript',
  'application/typescript',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'application/x-php',
  'text/html',
  'text/css',
  'application/json',
  'application/xml',
  'text/xml',
  'application/sql',
  'application/octet-stream',
]);

const DESIGN_MIME_TYPES = Object.freeze([
  'image/svg+xml',
  'application/postscript',
  'image/vnd.adobe.photoshop',
  'application/x-sqlite3',
  'application/vnd.sqlite3',
]);

const ALLOWED_MIME_TYPES = Object.freeze([
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...ARCHIVE_MIME_TYPES,
  ...MEDIA_MIME_TYPES,
  ...CODE_MIME_TYPES,
  ...DESIGN_MIME_TYPES,
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const MAX_GENERAL_BYTES = 100 * 1024 * 1024;

const PRESIGN_PUT_EXPIRES_SEC = 600;
const PRESIGN_GET_EXPIRES_SEC = 900;

function isAllowedFolder(folder) {
  return ALLOWED_FOLDERS.includes(String(folder || '').trim().toLowerCase());
}

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(String(mimeType || '').trim().toLowerCase());
}

function getMaxBytesForMime(mimeType) {
  const mime = String(mimeType || '').trim().toLowerCase();
  if (IMAGE_MIME_TYPES.includes(mime)) return MAX_IMAGE_BYTES;
  if (DOCUMENT_MIME_TYPES.includes(mime)) return MAX_DOCUMENT_BYTES;
  if (ARCHIVE_MIME_TYPES.includes(mime) || MEDIA_MIME_TYPES.includes(mime)) return MAX_GENERAL_BYTES;
  return MAX_GENERAL_BYTES;
}

function validateUploadRequest({ fileName, mimeType, size, folder }) {
  const errors = [];
  const safeFolder = String(folder || '').trim().toLowerCase();
  const safeMime = String(mimeType || '').trim().toLowerCase();
  const safeName = String(fileName || '').trim();
  const numSize = Number(size);

  if (!safeName) errors.push('fileName is required');
  if (!safeMime) errors.push('mimeType is required');
  if (!Number.isFinite(numSize) || numSize <= 0) errors.push('size must be a positive number');
  if (!isAllowedFolder(safeFolder)) errors.push('folder is not allowed');

  const lowerName = safeName.toLowerCase();
  const blockedExt = [
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.dll', '.sys',
    '.vbs', '.vbe', '.wsf', '.wsh', '.ps1', '.psm1', '.reg', '.lnk', '.apk',
  ];
  if (blockedExt.some((ext) => lowerName.endsWith(ext))) {
    errors.push('executable or dangerous file type is not allowed');
  }

  const mimeAllowed = safeMime && isAllowedMimeType(safeMime);
  if (safeMime && !mimeAllowed) errors.push('mimeType is not allowed');

  if (safeMime && Number.isFinite(numSize) && numSize > 0) {
    const max = getMaxBytesForMime(safeMime);
    if (numSize > max) errors.push('file size exceeds limit');
  }

  return { valid: errors.length === 0, errors, folder: safeFolder, mimeType: safeMime, size: numSize };
}

/**
 * Sanitize a client-provided file name (no path segments).
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeFileName(fileName) {
  const base = path.basename(String(fileName || '').trim());
  if (!base || base === '.' || base === '..') return 'file';
  return base
    .replace(/[^a-zA-Z0-9._\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200);
}

/**
 * @param {string} folder
 * @param {string} fileName
 * @returns {string}
 */
function buildStorageKey(folder, fileName) {
  const safeFolder = String(folder || 'general').trim().toLowerCase();
  if (!isAllowedFolder(safeFolder)) {
    throw new Error('Invalid folder');
  }
  if (safeFolder.includes('..') || safeFolder.includes('/')) {
    throw new Error('Invalid folder');
  }
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const safe = sanitizeFileName(fileName);
  return `uploads/${safeFolder}/${yyyy}/${mm}/${uuid}-${safe}`;
}

function assertSafeStorageKey(storageKey) {
  const key = String(storageKey || '').trim();
  if (!key || key.includes('..') || path.isAbsolute(key) || !key.startsWith('uploads/')) {
    throw new Error('Invalid storage key');
  }
  return key;
}

module.exports = {
  ALLOWED_FOLDERS,
  ALLOWED_MIME_TYPES,
  IMAGE_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  ARCHIVE_MIME_TYPES,
  MEDIA_MIME_TYPES,
  CODE_MIME_TYPES,
  DESIGN_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
  MAX_GENERAL_BYTES,
  PRESIGN_PUT_EXPIRES_SEC,
  PRESIGN_GET_EXPIRES_SEC,
  isAllowedFolder,
  isAllowedMimeType,
  getMaxBytesForMime,
  validateUploadRequest,
  sanitizeFileName,
  buildStorageKey,
  assertSafeStorageKey,
};
