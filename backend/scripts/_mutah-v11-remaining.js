'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { countBidiVisual, cellPlainText } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const JSZip = require('jszip');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const REMAINING_APP_IDS = [
  '216f81e3-b927-4977-8aef-85a42119ac17',
  '99eef60c-e498-40a7-9348-3e4bcff2bf46',
  'd81726e6-815d-43dd-8709-88357c14a6e5',
  '4c36f658-e7b8-45b7-affd-4fc80f68fa34',
  'ad0567a2-ddbc-47b7-af32-2f9aeb6a39a7',
];
const FAILED_LETTER_APP = '1d3801c4-18ff-494e-8e3a-ce39e8ed03d7';
const OUT_DIR = path.join(__dirname, '../tmp/mutah-v11-finalize');

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function inspectBuffer(buffer) {
  const inspect = await inspectFilledDocx(buffer);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const score = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
  return {
    pageCount: inspect.pageCount,
    checkmarks: inspect.checkmarks,
    stamp: inspect.hasOfficialStamp,
    signatures: inspect.hasSignatures,
    media: inspect.media.length,
    bidiVisual: countBidiVisual(score),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const generated = await service.generateForApplications(user, REMAINING_APP_IDS, {
    regenerate: true,
    regenerationReason: 'MUTAH_V11_REMAINING_NOT_ELIGIBLE_AND_MISSING',
    finalize: true,
    mutahSoftDelivery: true,
  });

  const samples = [];
  for (const row of generated.results) {
    if (!row.evaluationId && !row.applicationId) {
      samples.push({ ...row, inspect: null });
      continue;
    }
    const evaluation =
      row.evaluationId ||
      (
        await prisma.field_training_final_evaluations.findFirst({
          where: { application_id: row.applicationId, is_current: true },
          select: { id: true },
        })
      )?.id;
    if (!evaluation) {
      samples.push({ ...row, inspect: null });
      continue;
    }
    try {
      const downloaded = await service.downloadReport(user, evaluation);
      const inspect = await inspectBuffer(downloaded.buffer);
      if (row.eligibilityStatus === 'NOT_ELIGIBLE') {
        fs.writeFileSync(path.join(OUT_DIR, downloaded.filename || `${row.applicationId}.docx`), downloaded.buffer);
      }
      samples.push({ ...row, inspect });
    } catch (err) {
      samples.push({ ...row, inspectError: err.message, code: err.code });
    }
  }

  let letterRetry = null;
  try {
    letterRetry = await letterService.issueOne(FAILED_LETTER_APP, user.userId, user, {});
  } catch (err) {
    letterRetry = { failed: true, code: err.code, message: err.message };
  }

  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });

  const out = { generated: generated.results, samples, letterRetry, versions };
  fs.writeFileSync(path.join(OUT_DIR, 'v11-remaining-out.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
