'use strict';

const JSZip = require('jszip');
const {
  buildEvaluationPdfFilename,
  buildZipFilename,
  uniqueZipEntry,
  zipFolderForStatus,
} = require('./fieldTrainingEvaluation.filename');

function summarizeZipSelection({ selected, included, missing, failed }) {
  return {
    selected: selected.length,
    included: included.length,
    missing: missing.length,
    failed: failed.length,
    missingIds: missing.map((row) => row.id || row.application_id),
    failedIds: failed.map((row) => row.id || row.application_id),
  };
}

async function buildReportsZip(entries, { mixedFolders = true, onFile } = {}) {
  const zip = new JSZip();
  const used = new Set();
  const included = [];
  const failed = [];
  for (const entry of entries) {
    try {
      const folder = zipFolderForStatus(entry.finalStatus || entry.final_status);
      const filename = entry.filename || buildEvaluationPdfFilename({
        studentName: entry.studentName,
        universityNumber: entry.universityNumber,
        student: entry.student,
      });
      const path = uniqueZipEntry(used, folder, filename, mixedFolders);
      const buffer = onFile ? await onFile(entry) : entry.buffer;
      if (!buffer) {
        failed.push(entry);
        continue;
      }
      zip.file(path, buffer);
      included.push({ ...entry, zipPath: path });
    } catch {
      failed.push(entry);
    }
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, included, failed };
}

module.exports = {
  summarizeZipSelection,
  buildReportsZip,
  buildZipFilename,
};
