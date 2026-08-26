'use strict';

const JSZip = require('jszip');
const { extractPlaceholderNames, repairSplitPlaceholders, applyPlaceholdersToXml } = require('./fieldTrainingEvaluation.placeholders');

const XML_PATHS = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml',
];

async function readDocxXmlParts(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = [];
  for (const path of XML_PATHS) {
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async('string');
    parts.push({ path, xml });
  }
  return { zip, parts };
}

async function extractDocxPlaceholders(buffer) {
  const { parts } = await readDocxXmlParts(buffer);
  const found = new Set();
  for (const part of parts) {
    const repaired = repairSplitPlaceholders(part.xml);
    for (const name of extractPlaceholderNames(repaired)) found.add(name);
  }
  return found;
}

async function fillDocxTemplate(buffer, values) {
  const { fillUniversityLabelForm } = require('./fieldTrainingEvaluation.formFill');
  const { zip, parts } = await readDocxXmlParts(buffer);
  for (const part of parts) {
    let xml = applyPlaceholdersToXml(part.xml, values);
    xml = fillUniversityLabelForm(xml, values);
    zip.file(part.path, xml);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function detectUniversityLabelFormFromBuffer(buffer) {
  const { detectUniversityLabelForm } = require('./fieldTrainingEvaluation.formFill');
  const { parts } = await readDocxXmlParts(buffer);
  const document = parts.find((part) => part.path === 'word/document.xml');
  return Boolean(document && detectUniversityLabelForm(document.xml));
}

function assertDocxUpload({ originalName, mimeType, size, buffer }) {
  const name = String(originalName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  const errors = [];
  if (!name.endsWith('.docx')) errors.push('extension');
  const allowedMime = new Set([
    '',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-docx',
  ]);
  if (mime && !allowedMime.has(mime)) {
    errors.push('mime');
  }
  if (!Number.isFinite(Number(size)) || Number(size) <= 0) errors.push('size');
  if (Number(size) > 50 * 1024 * 1024) errors.push('size');
  if (buffer && buffer.length >= 4) {
    const sig = buffer.subarray(0, 2).toString();
    if (sig !== 'PK') errors.push('zip');
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  readDocxXmlParts,
  extractDocxPlaceholders,
  fillDocxTemplate,
  detectUniversityLabelFormFromBuffer,
  assertDocxUpload,
};
