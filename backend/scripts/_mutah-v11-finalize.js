'use strict';

/**
 * Mutah V11 finalize:
 * 1. Activate/assign V11
 * 2. Generate ONE student and inspect
 * 3. If that passes, bulk-generate evaluations
 * 4. Issue completion letters for authoritative eligible students only
 *
 * Usage: node scripts/_mutah-v11-finalize.js
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { inspectTemplateBuffer } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.preflight');
const { inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const {
  countBidiVisual,
  cellPlainText,
  scoreGridHeaderCells,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const {
  reconcileZipUniversityNumbers,
  normalizeUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.mutahExcelDelivery');

const MUTAH_UNI_ID = '910ba424-10ec-44d2-8f7f-c68e7ea5e8cb';
const V11_TEMPLATE_ID = 'bd3797b2-6131-466a-a41a-25d460105f46';
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');
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
  if (!rows[0]) throw new Error('No active super_admin');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function activateV11(user) {
  const row = await prisma.field_training_evaluation_templates.findUnique({
    where: { id: V11_TEMPLATE_ID },
  });
  if (!row || Number(row.version) !== 11) {
    throw new Error('Mutah template version 11 was not found');
  }
  const file = await prisma.files.findFirst({
    where: { id: row.original_file_id, deleted_at: null },
  });
  const buffer = await getProvider().getObjectBuffer(file.storage_key);
  const inspection = await inspectTemplateBuffer(buffer);
  const signed = Boolean(inspection.hasSignatureLabel && inspection.mediaCount > 0);
  const stamped = Boolean(inspection.hasOfficialStampLabel && inspection.mediaCount > 0);
  if (!signed || !stamped || !inspection.mutahOfficial || !inspection.evaluationGridRecognized) {
    throw new Error(
      `V11 is not the signed/stamped official Mutah template (signed=${signed}, stamped=${stamped})`
    );
  }

  await prisma.field_training_evaluation_templates.update({
    where: { id: V11_TEMPLATE_ID },
    data: {
      validation_json: {
        ...(row.validation_json || {}),
        official: true,
        signed: true,
        stamped: true,
        officialVersion: 11,
        fillMode: row.validation_json?.fillMode || 'label_form',
        preflight: {
          ...((row.validation_json && row.validation_json.preflight) || {}),
          hasSignatureLabel: inspection.hasSignatureLabel,
          hasOfficialStampLabel: inspection.hasOfficialStampLabel,
          mediaCount: inspection.mediaCount,
          hasMedia: inspection.mediaCount > 0,
          mutahOfficial: inspection.mutahOfficial,
          evaluationGridRecognized: inspection.evaluationGridRecognized,
        },
      },
      updated_at: new Date(),
    },
  });

  await service.setDefaultTemplate(user, V11_TEMPLATE_ID);
  await service.assignOpportunityTemplate(user, OPPORTUNITY_ID, V11_TEMPLATE_ID);
  return { signed, stamped, mediaCount: inspection.mediaCount, version: 11, templateId: V11_TEMPLATE_ID };
}

async function inspectDocxBuffer(buffer) {
  const inspect = await inspectFilledDocx(buffer);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const score = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
  return {
    pageCount: inspect.pageCount,
    lastRenderedPageBreaks: inspect.lastRenderedPageBreaks,
    checkmarks: inspect.checkmarks,
    stamp: inspect.hasOfficialStamp,
    signatures: inspect.hasSignatures,
    media: inspect.media.length,
    bidiVisual: countBidiVisual(score),
    headers: scoreGridHeaderCells(score),
    tblpPr: /w:tblpPr/.test(score || ''),
  };
}

async function pickOneStudent() {
  const eligible = await prisma.field_training_applications.findFirst({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      status: 'approved',
      completion_eligibility_status: 'eligible',
    },
    orderBy: { created_at: 'asc' },
    select: { id: true, student_id: true, completion_eligibility_status: true, completed_training_hours: true },
  });
  if (!eligible) throw new Error('No eligible Mutah student found for the one-student test');
  const student = await prisma.users.findUnique({
    where: { id: eligible.student_id },
    select: { full_name: true, university_student_number: true, email: true },
  });
  return { ...eligible, student };
}

async function generateOne(user, applicationId) {
  return service.generateForApplications(user, [applicationId], {
    regenerate: true,
    regenerationReason: 'MUTAH_V11_ONE_STUDENT_QA',
    finalize: true,
    mutahSoftDelivery: true,
  });
}

async function resolveEvaluationId(row) {
  if (row.evaluationId) return row.evaluationId;
  if (!row.applicationId) return null;
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: row.applicationId, is_current: true },
    select: { id: true },
  });
  return current?.id || null;
}

async function buildZip(user, exportResult, excelRows) {
  const entries = [];
  const zipErrors = [];
  for (const row of exportResult.results) {
    if (!(row.generated || row.reused || row.evaluationId || row.applicationId)) {
      zipErrors.push({ universityNumber: row.universityNumber, error: 'no_evaluation' });
      continue;
    }
    const evaluationId = await resolveEvaluationId(row);
    if (!evaluationId) {
      zipErrors.push({ universityNumber: row.universityNumber, error: 'evaluation_missing' });
      continue;
    }
    try {
      const downloaded = await service.downloadReport(user, evaluationId);
      entries.push({
        buffer: downloaded.buffer,
        studentName: row.studentName,
        universityNumber: row.universityNumber,
        academicSupervisorName: row.academicSupervisorName,
        eligibilityStatus: row.eligibilityStatus,
        universityName: exportResult.universityName || 'جامعة مؤتة',
        filename: downloaded.filename || row.filename,
      });
    } catch (err) {
      zipErrors.push({
        universityNumber: row.universityNumber,
        evaluationId,
        error: err.message,
        code: err.code,
      });
    }
  }

  const zip = await buildReportsZip(entries, { officialFolders: true });
  const zipPath = path.join(OUT_DIR, 'جامعة_مؤتة_تقارير_تقييم_التدريب_الميداني.zip');
  fs.writeFileSync(zipPath, zip.buffer);
  const zipReconciliation = reconcileZipUniversityNumbers(
    excelRows.map((r) => r.universityNumber),
    zip.included.map((e) => normalizeUniversityNumber(e.universityNumber))
  );
  return { zipPath, zipReconciliation, zipErrors, included: zip.included.length };
}

async function afterState() {
  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status', 'is_current'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const counts = await prisma.field_training_applications.groupBy({
    by: ['completion_eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    _count: { _all: true },
  });
  const letters = await prisma.field_training_completion_letters.count({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      status: 'issued',
    },
  });
  const notEligibleLetters = await prisma.field_training_completion_letters.count({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      status: 'issued',
      field_training_applications: {
        completion_eligibility_status: { not: 'eligible' },
      },
    },
  });
  return { versions, applicationEligibility: counts, lettersIssued: letters, notEligibleLetters };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const activated = await activateV11(user);
  const one = await pickOneStudent();
  const oneGen = await generateOne(user, one.id);
  const oneResult = oneGen.results[0];
  const evaluationId = await resolveEvaluationId(oneResult);
  if (!evaluationId) {
    throw new Error(`One-student generate failed: ${JSON.stringify(oneResult)}`);
  }
  const downloaded = await service.downloadReport(user, evaluationId);
  const onePath = path.join(OUT_DIR, downloaded.filename || 'one-student.docx');
  fs.writeFileSync(onePath, downloaded.buffer);
  const oneInspect = await inspectDocxBuffer(downloaded.buffer);
  const onePass =
    oneInspect.pageCount === 2 &&
    oneInspect.bidiVisual === 0 &&
    oneInspect.media >= 4 &&
    oneInspect.stamp &&
    oneInspect.signatures &&
    oneInspect.tblpPr;
  const gate = {
    student: one.student,
    applicationId: one.id,
    eligibility: one.completion_eligibility_status,
    generate: oneResult,
    inspect: oneInspect,
    pass: onePass,
    path: onePath,
  };
  console.log(JSON.stringify({ phase: 'one-student', activated, gate }, null, 2));
  if (!onePass) {
    throw new Error('One-student V11 QA failed; bulk generation was not started');
  }

  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: 'MUTAH_V11_OFFICIAL_REPORT_POLICY',
  });
  const zipMeta = await buildZip(user, exportResult, excel.rows);

  const preview = await letterService.previewBulkIssue(OPPORTUNITY_ID, user, {});
  let letters = null;
  try {
    letters = await letterService.startBulkIssue(OPPORTUNITY_ID, user, { sync: true });
  } catch (err) {
    letters = {
      failed: true,
      code: err.code,
      message: err.message,
      preview,
    };
  }

  const after = await afterState();
  const out = {
    activated,
    oneStudent: gate,
    summary: exportResult.summary,
    unmatched: exportResult.unmatched,
    platformExcludedCount: exportResult.platformExcluded?.length || 0,
    technicalFailures: (exportResult.results || []).filter((r) => r.classification === 'FAILED_TECHNICAL'),
    zip: zipMeta,
    lettersPreview: {
      eligible: preview.eligible,
      letters_to_issue: preview.letters_to_issue,
      notEligibleExcluded: preview.notEligibleExcluded,
      alreadyCurrent: preview.alreadyCurrent,
    },
    letters,
    after,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'v11-finalize-out.json'), JSON.stringify(out, null, 2), 'utf8');
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
