/**
 * Course task submission attachment rules. Mirrors backend
 * `modules/trainingPrograms/taskSubmissionFileRules.js`; server values (task.submissionLimits) win.
 */

export const DEFAULT_TASK_SUBMISSION_LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 100 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
});

export const BLOCKED_EXTENSIONS = Object.freeze([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.dll', '.sys', '.vbs', '.vbe',
  '.wsf', '.wsh', '.ps1', '.psm1', '.psd1', '.reg', '.inf', '.lnk', '.jar', '.apk', '.app',
  '.dmg', '.iso',
]);

export function resolveTaskSubmissionLimits(serverLimits) {
  const s = serverLimits && typeof serverLimits === 'object' ? serverLimits : {};
  return {
    maxFiles: Number(s.maxFiles) > 0 ? Number(s.maxFiles) : DEFAULT_TASK_SUBMISSION_LIMITS.maxFiles,
    maxFileBytes:
      Number(s.maxFileBytes) > 0 ? Number(s.maxFileBytes) : DEFAULT_TASK_SUBMISSION_LIMITS.maxFileBytes,
    maxTotalBytes:
      Number(s.maxTotalBytes) > 0 ? Number(s.maxTotalBytes) : DEFAULT_TASK_SUBMISSION_LIMITS.maxTotalBytes,
  };
}

export function getFileExtension(name) {
  const base = String(name || '').replace(/[\s.]+$/, '');
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

/**
 * Display text for a file name inside RTL layouts. In "تقرير 2026.pdf" the dot between a
 * number and a Latin extension resolves to RTL and renders as "pdf.2026"; a left-to-right
 * mark before the dot keeps "2026.pdf" together. Names ending in letters render correctly
 * without it, so they are left untouched.
 */
export function displayFileName(name) {
  const value = String(name || '');
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || !/[0-9]/.test(value[dot - 1])) return value;
  return `${value.slice(0, dot)}\u200E${value.slice(dot)}`;
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const KIND_BY_EXT = {
  pdf: ['.pdf'],
  doc: ['.doc', '.docx', '.odt', '.rtf', '.txt', '.md', '.pages'],
  sheet: ['.xls', '.xlsx', '.ods', '.csv', '.numbers', '.tsv'],
  slides: ['.ppt', '.pptx', '.odp', '.key'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.svg'],
  video: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'],
  archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz'],
  code: [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.php', '.rb',
    '.go', '.rs', '.kt', '.swift', '.html', '.css', '.scss', '.json', '.xml', '.yml', '.yaml',
    '.sql', '.ipynb', '.sh', '.dart', '.vue',
  ],
  design: ['.psd', '.ai', '.fig', '.sketch', '.xd', '.indd', '.eps', '.dwg', '.dxf', '.blend', '.cdr'],
};

/** @returns {'pdf'|'doc'|'sheet'|'slides'|'image'|'video'|'audio'|'archive'|'code'|'design'|'other'} */
export function getFileKind(name, mimeType = '') {
  const ext = getFileExtension(name);
  for (const [kind, exts] of Object.entries(KIND_BY_EXT)) {
    if (exts.includes(ext)) return kind;
  }
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

export const TASK_UPLOAD_ERROR_MESSAGES = Object.freeze({
  FILE_TYPE_BLOCKED: 'هذا النوع من الملفات غير مسموح لأسباب أمنية (ملفات تنفيذية).',
  FILE_EMPTY: 'الملف فارغ ولا يمكن رفعه.',
  FILE_TOO_LARGE: 'حجم الملف يتجاوز الحد المسموح لكل ملف.',
  TOO_MANY_FILES: 'وصلت إلى الحد الأقصى لعدد الملفات في التسليم الواحد.',
  TOTAL_SIZE_EXCEEDED: 'مجموع أحجام الملفات يتجاوز الحد المسموح للتسليم.',
  DUPLICATE: 'هذا الملف مضاف بالفعل.',
  NETWORK: 'انقطع الاتصال أثناء الرفع. تحقق من الإنترنت ثم أعد المحاولة.',
  UNAUTHORIZED: 'انتهت جلستك. سجّل الدخول مرة أخرى ثم أعد المحاولة.',
  RATE_LIMIT: 'تجاوزت الحد المسموح لطلبات الرفع. حاول بعد قليل.',
  UPLOAD_FAILED: 'تعذّر رفع الملف. حاول مرة أخرى.',
});

/**
 * Client-side pre-check (the server re-validates everything).
 * @param {File} file
 * @param {{ maxFileBytes: number }} limits
 * @returns {{ valid: true } | { valid: false, code: string }}
 */
export function precheckTaskFile(file, limits) {
  if (!file) return { valid: false, code: 'UPLOAD_FAILED' };
  if (BLOCKED_EXTENSIONS.includes(getFileExtension(file.name))) {
    return { valid: false, code: 'FILE_TYPE_BLOCKED' };
  }
  if (!file.size) return { valid: false, code: 'FILE_EMPTY' };
  if (file.size > limits.maxFileBytes) return { valid: false, code: 'FILE_TOO_LARGE' };
  return { valid: true };
}

export function fileFingerprint(file) {
  return `${file?.name || ''}::${file?.size || 0}::${file?.lastModified || 0}`;
}
