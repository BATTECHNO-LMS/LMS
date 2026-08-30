'use strict';

const fs = require('fs');
const JSZip = require('jszip');
const {
  buildCompletionLetterPdfFilename,
  uniqueZipEntry,
} = require('./fieldTraining.completionLetter.filename');

async function buildCompletionLettersZip(entries, { onFile } = {}) {
  const zip = new JSZip();
  const used = new Set();
  const included = [];
  const failed = [];
  const usedAppIds = new Set();

  for (const entry of entries) {
    try {
      if (entry.applicationId && usedAppIds.has(entry.applicationId)) {
        failed.push({ ...entry, reason: 'duplicate_application' });
        continue;
      }
      if (entry.applicationId) usedAppIds.add(entry.applicationId);
      const filename =
        entry.filename ||
        buildCompletionLetterPdfFilename({
          studentName: entry.studentName,
          universityNumber: entry.universityNumber,
        });
      if (!filename) {
        failed.push({ ...entry, reason: 'missing_filename' });
        continue;
      }
      const zipPath = uniqueZipEntry(
        used,
        filename,
        entry.supervisorFolder || entry.supervisorName || ''
      );
      const buffer = onFile ? await onFile(entry) : entry.buffer;
      if (!buffer) {
        failed.push({ ...entry, reason: 'missing_pdf' });
        continue;
      }
      zip.file(zipPath, buffer);
      included.push({ ...entry, zipPath, filename: zipPath });
    } catch (err) {
      failed.push({ ...entry, reason: err?.message || 'zip_failed' });
    }
  }

  const stream = zip.generateNodeStream({
    type: 'nodebuffer',
    streamFiles: true,
    compression: 'DEFLATE',
  });
  return { stream, included, failed, selected: entries.length };
}

function readPdfBuffer(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return null;
  return fs.readFileSync(absPath);
}

module.exports = {
  buildCompletionLettersZip,
  readPdfBuffer,
};
