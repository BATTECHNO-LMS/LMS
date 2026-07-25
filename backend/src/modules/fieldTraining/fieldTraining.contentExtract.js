const path = require('path');
const { ApiError } = require('../../utils/apiError');
const { getProvider } = require('../../shared/storage/storageProvider');
const { IMAGE_MIME_TYPES } = require('../../shared/storage/fileRules');
const { isArchiveFile, getExtension } = require('./fieldTraining.submissionFileRules');

const MAX_EXTRACT_CHARS = 40000;

/** Extensions the AI extract pipeline can actually read (keep in sync with extractTextFromBuffer). */
const AI_SUPPORTED_EXTENSIONS = Object.freeze([
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.rtf',
  '.csv',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.html',
  '.css',
  '.json',
  '.py',
  '.java',
  '.php',
  '.sql',
  '.c',
  '.cpp',
  '.cs',
]);

const AI_SUPPORTED_NOTES =
  'يستطيع الذكاء الاصطناعي قراءة وتحليل الملفات النصية والمستندات والصور وبعض ملفات البرمجة. الملفات المضغوطة أو غير المدعومة يمكن رفعها وتسليمها، لكنها قد لا تكون قابلة للتحليل تلقائيًا.';

const SOURCE_CODE_EXTENSIONS = Object.freeze([
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.html',
  '.css',
  '.json',
  '.py',
  '.java',
  '.php',
  '.sql',
  '.c',
  '.cpp',
  '.cs',
  '.md',
  '.rtf',
]);

function truncate(text, max = MAX_EXTRACT_CHARS) {
  const s = String(text || '').replace(/\0/g, '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[… تم اقتصاص النص لتجاوز الحد المسموح …]`;
}

async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return truncate(data?.text || '');
}

async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return truncate(result?.value || '');
}

async function extractPptx(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const parts = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async('string');
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (texts.length) parts.push(texts.join(' '));
  }
  return truncate(parts.join('\n\n'));
}

function isPlainTextLike(mime, name) {
  if (
    mime === 'text/plain' ||
    mime === 'text/csv' ||
    mime === 'text/markdown' ||
    mime === 'text/x-markdown' ||
    mime === 'application/rtf' ||
    mime === 'text/rtf' ||
    mime === 'application/json' ||
    mime === 'text/html' ||
    mime === 'text/css' ||
    mime === 'application/javascript' ||
    mime === 'text/javascript' ||
    mime === 'application/typescript' ||
    mime === 'text/x-python' ||
    mime === 'text/x-java-source' ||
    mime === 'text/x-c' ||
    mime === 'text/x-c++' ||
    mime === 'text/x-csharp' ||
    mime === 'application/x-php' ||
    mime === 'application/sql' ||
    mime === 'application/xml' ||
    mime === 'text/xml'
  ) {
    return true;
  }
  return SOURCE_CODE_EXTENSIONS.some((ext) => name.endsWith(ext)) || name.endsWith('.txt') || name.endsWith('.csv');
}

function isAiSupportedFile({ mimeType, fileName }) {
  const name = String(fileName || '').toLowerCase();
  const ext = getExtension(name);
  if (AI_SUPPORTED_EXTENSIONS.includes(ext)) return true;
  const mime = String(mimeType || '').toLowerCase();
  if (IMAGE_MIME_TYPES.includes(mime)) return true;
  if (mime === 'application/pdf') return true;
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return true;
  if (isPlainTextLike(mime, name)) return true;
  return false;
}

function getAiSupportedFileTypesConfig() {
  const {
    MAX_FILE_BYTES,
    MAX_FILES_PER_SUBMISSION,
    MAX_TOTAL_SUBMISSION_BYTES,
  } = require('./fieldTraining.submissionFileRules');
  return {
    extensions: [...AI_SUPPORTED_EXTENSIONS],
    maxFileSize: MAX_FILE_BYTES,
    maxFiles: MAX_FILES_PER_SUBMISSION,
    maxTotalSize: MAX_TOTAL_SUBMISSION_BYTES,
    notes: AI_SUPPORTED_NOTES,
  };
}

/**
 * @param {{ buffer: Buffer, mimeType?: string | null, fileName?: string | null }} params
 * @returns {Promise<{ status: string, text: string | null, error: string | null, meta?: object }>}
 */
async function extractTextFromBuffer({ buffer, mimeType, fileName }) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  try {
    if (!buffer || !buffer.length) {
      return { status: 'empty', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }

    if (isArchiveFile(fileName, mimeType)) {
      return {
        status: 'unsupported',
        text: null,
        error:
          'تم رفع الملف بنجاح، لكن الملف المضغوط لن يتم تحليله تلقائيًا. أرفق وصفًا للحل أو ملفًا مدعومًا للحصول على تقييم أدق.',
        meta: { isArchive: true },
      };
    }

    if (isPlainTextLike(mime, name)) {
      const text = truncate(buffer.toString('utf8'));
      return text
        ? { status: 'ok', text, error: null }
        : { status: 'empty', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const text = await extractPdf(buffer);
      return text
        ? { status: 'ok', text, error: null }
        : { status: 'empty', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      const text = await extractDocx(buffer);
      return text
        ? { status: 'ok', text, error: null }
        : { status: 'empty', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      name.endsWith('.pptx')
    ) {
      const text = await extractPptx(buffer);
      return text
        ? { status: 'ok', text, error: null }
        : { status: 'empty', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }

    if (IMAGE_MIME_TYPES.includes(mime) || /\.(jpe?g|png|webp|gif)$/i.test(name)) {
      return {
        status: 'partial',
        text: `[صورة مرفقة للتحليل]\nالاسم: ${fileName || 'image'}\nالنوع: ${mime || 'image'}\nالحجم: ${buffer.length} بايت\nملاحظة: لم يُستخرج نص من الصورة. اعتمد على وصف الطالب فقط ولا تخترع محتوى بصريًا.`,
        error: null,
        meta: { isImage: true },
      };
    }

    if (mime === 'application/msword' || name.endsWith('.doc')) {
      return {
        status: 'unsupported',
        text: null,
        error: 'نوع الملف غير مدعوم للتحليل التلقائي (.doc). استخدم .docx أو أرفق وصفًا.',
      };
    }

    return {
      status: 'unsupported',
      text: null,
      error: 'نوع الملف غير مدعوم للتحليل التلقائي، لكن يمكن تسليمه مع وصف الحل.',
    };
  } catch {
    return {
      status: 'failed',
      text: null,
      error: 'تعذر قراءة الملف المرفق.',
    };
  }
}

/**
 * Read a stored file by storage key and extract text.
 */
async function extractTextFromStorageKey({ storageKey, mimeType, fileName }) {
  try {
    const provider = getProvider();
    if (typeof provider.getObjectBuffer !== 'function') {
      return { status: 'failed', text: null, error: 'تعذر قراءة الملف المرفق.' };
    }
    const buffer = await provider.getObjectBuffer(storageKey);
    return extractTextFromBuffer({ buffer, mimeType, fileName });
  } catch {
    return { status: 'failed', text: null, error: 'تعذر قراءة الملف المرفق.' };
  }
}

module.exports = {
  MAX_EXTRACT_CHARS,
  AI_SUPPORTED_EXTENSIONS,
  AI_SUPPORTED_NOTES,
  isAiSupportedFile,
  getAiSupportedFileTypesConfig,
  extractTextFromBuffer,
  extractTextFromStorageKey,
};
