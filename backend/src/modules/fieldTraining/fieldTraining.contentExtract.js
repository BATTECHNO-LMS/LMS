const { ApiError } = require('../../utils/apiError');
const { getProvider } = require('../../shared/storage/storageProvider');
const { IMAGE_MIME_TYPES } = require('../../shared/storage/fileRules');

const MAX_EXTRACT_CHARS = 40000;

function truncate(text, max = MAX_EXTRACT_CHARS) {
  const s = String(text || '').replace(/\0/g, '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[… تم اقتصاص النص لتجاوز الحد المسموح …]`;
}

async function extractPdf(buffer) {
  // pdf-parse v1 exports a function; keep require lazy for startup cost
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

    if (mime === 'text/plain' || mime === 'text/csv' || name.endsWith('.txt') || name.endsWith('.csv')) {
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
        error: 'نوع الملف غير مدعوم.',
      };
    }

    return {
      status: 'unsupported',
      text: null,
      error: 'نوع الملف غير مدعوم.',
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
  extractTextFromBuffer,
  extractTextFromStorageKey,
};
