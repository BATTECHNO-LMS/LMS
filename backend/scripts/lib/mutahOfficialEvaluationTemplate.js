'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  OFFICIAL_MUTAH_TEMPLATE_FILENAME,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
} = require('../../src/modules/fieldTraining/fieldTrainingEvaluation.constants');

const MUTAH_NAME_AR = 'جامعة مؤتة';
const MUTAH_DOMAIN = 'mutah.edu.jo';

function officialTemplateDir() {
  return path.join(__dirname, '..', '..', 'assets', 'field-training');
}

function officialTemplatePath() {
  const dir = officialTemplateDir();
  const arabic = path.join(dir, OFFICIAL_MUTAH_TEMPLATE_FILENAME);
  if (fs.existsSync(arabic)) return arabic;
  const ascii = path.join(dir, 'mutah-official-evaluation.docx');
  if (fs.existsSync(ascii)) return ascii;
  return arabic;
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isMutahUniversity(row) {
  if (!row) return false;
  const name = String(row.name || '').trim();
  const nameEn = String(row.name_en || '').trim().toLowerCase();
  const domain = String(row.domain || row.website || '').toLowerCase();
  return (
    name === MUTAH_NAME_AR ||
    nameEn.includes('mutah') ||
    domain.includes(MUTAH_DOMAIN)
  );
}

module.exports = {
  MUTAH_NAME_AR,
  MUTAH_DOMAIN,
  officialTemplateDir,
  officialTemplatePath,
  sha256File,
  isMutahUniversity,
  OFFICIAL_MUTAH_TEMPLATE_FILENAME,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
};
