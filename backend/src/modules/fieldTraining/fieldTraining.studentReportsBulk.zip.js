'use strict';

const JSZip = require('jszip');
const {
  buildStudentReportPdfFilename,
  uniqueZipEntry,
} = require('./fieldTraining.studentReportsBulk.filename');

/**
 * Build a ZIP of student report PDFs with bounded concurrency.
 * Prefers releasing each PDF buffer after it is handed to JSZip.
 */
async function buildStudentReportsZip(entries, { onFile, concurrency = 3, onProgress } = {}) {
  const zip = new JSZip();
  const used = new Set();
  const included = [];
  const failed = [];
  const limit = Math.max(1, Math.min(5, Number(concurrency) || 3));
  const list = Array.isArray(entries) ? entries : [];

  for (let i = 0; i < list.length; i += limit) {
    const batch = list.slice(i, i + limit);
    const results = await Promise.all(
      batch.map(async (entry, batchIndex) => {
        const index = i + batchIndex + 1;
        try {
          const buffer = onFile ? await onFile(entry, index) : entry.buffer;
          if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 5) {
            return { entry, index, error: 'missing_or_invalid_pdf' };
          }
          const magic = buffer.subarray(0, 4).toString('utf8');
          if (magic !== '%PDF') {
            return { entry, index, error: 'not_a_pdf' };
          }
          return { entry, index, buffer };
        } catch (err) {
          return { entry, index, error: err?.code || err?.message || 'pdf_failed' };
        }
      })
    );

    for (const result of results) {
      if (!result.buffer) {
        failed.push({
          applicationId: result.entry.applicationId,
          studentName: result.entry.studentName,
          universityNumber: result.entry.universityNumber,
          reason: String(result.error || 'failed'),
        });
        if (typeof onProgress === 'function') {
          await onProgress({
            completed: included.length + failed.length,
            total: list.length,
            included: included.length,
            failed: failed.length,
          });
        }
        continue;
      }
      const filename =
        result.entry.filename ||
        buildStudentReportPdfFilename({
          index: result.index,
          studentName: result.entry.studentName,
          universityNumber: result.entry.universityNumber,
        });
      const zipPath = uniqueZipEntry(used, filename);
      zip.file(zipPath, result.buffer);
      included.push({
        applicationId: result.entry.applicationId,
        studentName: result.entry.studentName,
        universityNumber: result.entry.universityNumber,
        zipPath,
      });
      if (typeof onProgress === 'function') {
        await onProgress({
          completed: included.length + failed.length,
          total: list.length,
          included: included.length,
          failed: failed.length,
        });
      }
    }
  }

  if (failed.length) {
    const lines = [
      'تعذر إنشاء بعض تقارير الطلاب أثناء التصدير الجماعي.',
      `الناجحة: ${included.length}`,
      `الفاشلة: ${failed.length}`,
      '',
      ...failed.map(
        (row, idx) =>
          `${idx + 1}. ${row.studentName || 'طالب'} (${row.universityNumber || 'بدون رقم'}) — ${row.reason}`
      ),
    ];
    zip.file('EXPORT_ERRORS.txt', Buffer.from(lines.join('\n'), 'utf8'));
  }

  const stream = zip.generateNodeStream({
    type: 'nodebuffer',
    streamFiles: true,
    compression: 'DEFLATE',
  });

  return {
    stream,
    included,
    failed,
    selected: list.length,
  };
}

module.exports = {
  buildStudentReportsZip,
};
