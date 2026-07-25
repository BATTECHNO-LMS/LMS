/**
 * Field-training submission file rules: broad upload allowlist with security controls.
 * Archives and media are accepted for delivery; AI extractability is separate (contentExtract).
 */

const path = require('path');
const { sanitizeFileName } = require('../../shared/storage/fileRules');

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB per file
const MAX_FILES_PER_SUBMISSION = 10;
const MAX_TOTAL_SUBMISSION_BYTES = 200 * 1024 * 1024; // 200 MB total

/** Executables / scripts that must never be accepted for upload. */
const BLOCKED_EXTENSIONS = Object.freeze([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.pif',
  '.dll',
  '.sys',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
  '.psd1',
  '.reg',
  '.inf',
  '.lnk',
  '.jar',
  '.apk',
  '.app',
  '.dmg',
  '.iso',
]);

const ARCHIVE_EXTENSIONS = Object.freeze(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz']);

const ARCHIVE_MIME_TYPES = Object.freeze([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-gtar',
]);

const VIDEO_MIME_TYPES = Object.freeze([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
]);

const AUDIO_MIME_TYPES = Object.freeze([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
]);

const DESIGN_MIME_TYPES = Object.freeze([
  'application/postscript',
  'image/svg+xml',
  'application/illustrator',
  'image/vnd.adobe.photoshop',
  'application/x-photoshop',
]);

const DATABASE_MIME_TYPES = Object.freeze([
  'application/x-sqlite3',
  'application/vnd.sqlite3',
  'application/sql',
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
  'text/markdown',
  'text/x-markdown',
  'application/rtf',
  'text/rtf',
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
]);

const IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

/** Broad allowlist for field-training project deliveries (not AI extract list). */
const ALLOWED_MIME_TYPES = Object.freeze([
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
  ...ARCHIVE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...DESIGN_MIME_TYPES,
  ...DATABASE_MIME_TYPES,
  ...CODE_MIME_TYPES,
  'application/octet-stream',
]);

const EXTENSION_MIME_FALLBACK = Object.freeze({
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.tgz': 'application/gzip',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.rtf': 'application/rtf',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.js': 'application/javascript',
  '.ts': 'application/typescript',
  '.jsx': 'application/javascript',
  '.tsx': 'application/typescript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.py': 'text/x-python',
  '.java': 'text/x-java-source',
  '.php': 'application/x-php',
  '.sql': 'application/sql',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.cs': 'text/x-csharp',
  '.svg': 'image/svg+xml',
  '.psd': 'image/vnd.adobe.photoshop',
  '.ai': 'application/postscript',
  '.sqlite': 'application/x-sqlite3',
  '.db': 'application/x-sqlite3',
});

function getExtension(fileName) {
  const base = path.basename(String(fileName || ''));
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

function isBlockedExtension(fileName) {
  return BLOCKED_EXTENSIONS.includes(getExtension(fileName));
}

function isArchiveFile(fileName, mimeType) {
  const ext = getExtension(fileName);
  if (ARCHIVE_EXTENSIONS.includes(ext)) return true;
  const mime = String(mimeType || '').toLowerCase();
  return ARCHIVE_MIME_TYPES.includes(mime);
}

function resolveMimeType(fileName, mimeType) {
  const mime = String(mimeType || '').trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream') return mime;
  const fallback = EXTENSION_MIME_FALLBACK[getExtension(fileName)];
  return fallback || mime || 'application/octet-stream';
}

function isAllowedSubmissionFile({ fileName, mimeType, size }) {
  const errors = [];
  const safeName = sanitizeFileName(fileName);
  const ext = getExtension(safeName || fileName);

  if (!safeName || safeName === 'file') {
    // sanitize may return 'file' for empty — still check original
    if (!String(fileName || '').trim()) errors.push('fileName is required');
  }
  if (isBlockedExtension(fileName) || isBlockedExtension(safeName)) {
    errors.push('executable or dangerous file type is not allowed');
  }

  const resolvedMime = resolveMimeType(fileName, mimeType);
  const knownExt = Boolean(EXTENSION_MIME_FALLBACK[ext]);
  const mimeOk =
    ALLOWED_MIME_TYPES.includes(resolvedMime) ||
    (resolvedMime === 'application/octet-stream' && knownExt);

  if (!mimeOk && !knownExt) {
    errors.push('mimeType / extension is not allowed');
  }

  const numSize = Number(size);
  if (!Number.isFinite(numSize) || numSize <= 0) {
    errors.push('size must be a positive number');
  } else if (numSize > MAX_FILE_BYTES) {
    errors.push('file size exceeds limit');
  }

  return {
    valid: errors.length === 0,
    errors,
    fileName: safeName,
    mimeType: resolvedMime,
    size: numSize,
    isArchive: isArchiveFile(fileName, resolvedMime),
    extension: ext,
  };
}

function validateSubmissionFilesList(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length > MAX_FILES_PER_SUBMISSION) {
    return {
      valid: false,
      errors: [`maximum ${MAX_FILES_PER_SUBMISSION} files per submission`],
    };
  }
  let total = 0;
  const validated = [];
  for (const f of list) {
    const result = isAllowedSubmissionFile(f);
    if (!result.valid) {
      return { valid: false, errors: result.errors, fileName: f?.fileName };
    }
    total += result.size;
    validated.push(result);
  }
  if (total > MAX_TOTAL_SUBMISSION_BYTES) {
    return {
      valid: false,
      errors: ['total submission size exceeds limit'],
    };
  }
  return { valid: true, errors: [], files: validated, totalSize: total };
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
  MAX_TOTAL_SUBMISSION_BYTES,
  BLOCKED_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  ARCHIVE_MIME_TYPES,
  ALLOWED_MIME_TYPES,
  EXTENSION_MIME_FALLBACK,
  getExtension,
  isBlockedExtension,
  isArchiveFile,
  resolveMimeType,
  isAllowedSubmissionFile,
  validateSubmissionFilesList,
  sanitizeFileName,
};
