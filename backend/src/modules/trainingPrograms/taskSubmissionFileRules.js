'use strict';

/**
 * Central rules for course (training program) task submission attachments.
 * Mirrored on the frontend in features/training/taskSubmissionLimits.js and served to
 * clients via `submissionLimits` on trainee task payloads. Per-file size must stay below
 * Nginx `client_max_body_size` (120m in deploy/nginx-eprojecto.com.conf and frontend/nginx.conf).
 */

const path = require('path');
const {
  BLOCKED_EXTENSIONS,
  isArchiveFile,
  resolveMimeType,
} = require('../fieldTraining/fieldTraining.submissionFileRules');

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES_PER_SUBMISSION = 10;
const MAX_TOTAL_SUBMISSION_BYTES = 250 * 1024 * 1024;
const MAX_ORIGINAL_NAME_LENGTH = 255;
const DRAFT_ENTITY_TYPE = 'training_task_submission_draft';
const ATTACHED_ENTITY_TYPE = 'training_task_submission';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** MIME types a browser could render/execute inline; always served as opaque bytes. */
const ACTIVE_CONTENT_MIME_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/ecmascript',
  'text/ecmascript',
  'application/xml',
  'text/xml',
  'application/x-shockwave-flash',
]);

const LIMITS = Object.freeze({
  maxFiles: MAX_FILES_PER_SUBMISSION,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: MAX_TOTAL_SUBMISSION_BYTES,
  blockedExtensions: BLOCKED_EXTENSIONS,
});

/**
 * Busboy (multer 1.x) decodes multipart filenames as latin1; recover UTF-8 names (Arabic etc.).
 * @param {string} name
 */
function decodeMultipartFileName(name) {
  const s = String(name || '');
  if (!/[\u0080-\u00ff]/.test(s) || /[^\u0000-\u00ff]/.test(s)) return s;
  const decoded = Buffer.from(s, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? s : decoded;
}

/**
 * Display/metadata name: strip paths, control chars and reserved characters; keep the extension.
 * @param {string} name
 */
function normalizeOriginalName(name) {
  let base = path.basename(String(name || '').replace(/\\/g, '/'));
  base = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^[\s.]+/, '')
    .replace(/[\s.]+$/, '')
    .trim();
  if (!base) return 'file';
  if (base.length <= MAX_ORIGINAL_NAME_LENGTH) return base;
  const ext = path.extname(base).slice(0, 20);
  return `${base.slice(0, MAX_ORIGINAL_NAME_LENGTH - ext.length)}${ext}`;
}

function getExtension(name) {
  const base = String(name || '').replace(/[\s.]+$/, '');
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

function isBlockedFileName(name) {
  return BLOCKED_EXTENSIONS.includes(getExtension(name));
}

/**
 * Validate a single submission attachment. Any type is accepted except executables/installers.
 * @param {{ fileName: string, mimeType?: string, size: number }} input
 */
function validateSubmissionFile({ fileName, mimeType, size }) {
  const originalName = normalizeOriginalName(fileName);
  const numSize = Number(size);
  if (isBlockedFileName(fileName) || isBlockedFileName(originalName)) {
    return { valid: false, code: 'FILE_TYPE_BLOCKED' };
  }
  if (!Number.isFinite(numSize) || numSize <= 0) {
    return { valid: false, code: 'FILE_EMPTY' };
  }
  if (numSize > MAX_FILE_BYTES) {
    return { valid: false, code: 'FILE_TOO_LARGE' };
  }
  const resolvedMime = resolveMimeType(originalName, mimeType);
  return {
    valid: true,
    originalName,
    mimeType: /^[\w.+-]+\/[\w.+-]+$/.test(resolvedMime) ? resolvedMime : 'application/octet-stream',
    size: numSize,
    isArchive: isArchiveFile(originalName, resolvedMime),
  };
}

/**
 * @param {Array<{ size: number }>} files
 */
function validateSubmissionFileSet(files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length > MAX_FILES_PER_SUBMISSION) return { valid: false, code: 'TOO_MANY_FILES' };
  const total = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  if (total > MAX_TOTAL_SUBMISSION_BYTES) return { valid: false, code: 'TOTAL_SIZE_EXCEEDED' };
  return { valid: true, totalBytes: total };
}

function downloadContentType(mimeType) {
  const mime = String(mimeType || '').toLowerCase().split(';')[0].trim();
  if (!mime || ACTIVE_CONTENT_MIME_TYPES.has(mime) || mime.startsWith('text/')) {
    return 'application/octet-stream';
  }
  return mime;
}

/** RFC 6266 / 5987 Content-Disposition with an ASCII fallback and UTF-8 filename*. */
function attachmentDisposition(fileName) {
  const name = normalizeOriginalName(fileName);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_') || 'file';
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

const ERROR_MESSAGES = Object.freeze({
  FILE_TYPE_BLOCKED: 'هذا النوع من الملفات غير مسموح لأسباب أمنية (ملفات تنفيذية).',
  FILE_EMPTY: 'الملف فارغ ولا يمكن رفعه.',
  FILE_TOO_LARGE: `حجم الملف يتجاوز الحد المسموح (${MAX_FILE_BYTES / (1024 * 1024)} ميجابايت لكل ملف).`,
  TOO_MANY_FILES: `لا يمكن إرفاق أكثر من ${MAX_FILES_PER_SUBMISSION} ملفات في التسليم الواحد.`,
  TOTAL_SIZE_EXCEEDED: `مجموع أحجام الملفات يتجاوز الحد المسموح (${MAX_TOTAL_SUBMISSION_BYTES / (1024 * 1024)} ميجابايت).`,
  FILE_REQUIRED: 'لم يتم إرفاق ملف.',
  UPLOAD_FAILED: 'تعذّر رفع الملف. حاول مرة أخرى.',
  STORAGE_ERROR: 'تعذّر حفظ الملف حالياً. حاول لاحقاً.',
  FILE_NOT_AVAILABLE: 'أحد الملفات المرفقة غير متاح. أعد رفعه ثم حاول التسليم.',
  SUBMISSION_EMPTY: 'أضف ملفاً واحداً على الأقل أو اكتب نص التسليم.',
});

module.exports = {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SUBMISSION,
  MAX_TOTAL_SUBMISSION_BYTES,
  DRAFT_ENTITY_TYPE,
  ATTACHED_ENTITY_TYPE,
  DRAFT_TTL_MS,
  LIMITS,
  ERROR_MESSAGES,
  decodeMultipartFileName,
  normalizeOriginalName,
  getExtension,
  isBlockedFileName,
  validateSubmissionFile,
  validateSubmissionFileSet,
  downloadContentType,
  attachmentDisposition,
};
