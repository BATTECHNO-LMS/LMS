'use strict';

const JSZip = require('jszip');
const {
  buildEvaluationPdfFilename,
  buildOfficialEvaluationsZipFilename,
  uniqueZipEntry,
  zipFolderForStatus,
  buildOfficialEvaluationZipPath,
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

async function buildReportsZip(entries, { mixedFolders = true, folderFor, onFile, officialFolders = false } = {}) {
  const zip = new JSZip();
  const used = new Set();
  const included = [];
  const failed = [];
  const resolveFolder =
    folderFor ||
    (officialFolders
      ? (entry) =>
          buildOfficialEvaluationZipPath({
            universityName: entry.universityName,
            academicSupervisorName: entry.academicSupervisorName,
            eligibilityStatus: entry.eligibilityStatus || entry.eligibility_status,
            filename: '',
          }).replace(/\/$/, '')
      : (entry) => zipFolderForStatus(entry.finalStatus || entry.final_status));
  for (const entry of entries) {
    try {
      const filename = entry.filename || buildEvaluationPdfFilename({
        studentName: entry.studentName,
        universityNumber: entry.universityNumber,
        student: entry.student,
      });
      let path;
      if (officialFolders && !folderFor) {
        path = uniqueZipEntry(
          used,
          '',
          buildOfficialEvaluationZipPath({
            universityName: entry.universityName,
            academicSupervisorName: entry.academicSupervisorName,
            eligibilityStatus: entry.eligibilityStatus || entry.eligibility_status,
            filename,
          }),
          false
        );
      } else {
        const folder = resolveFolder(entry);
        path = uniqueZipEntry(used, folder, filename, mixedFolders);
      }
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
  buildZipFilename: buildOfficialEvaluationsZipFilename,
};
