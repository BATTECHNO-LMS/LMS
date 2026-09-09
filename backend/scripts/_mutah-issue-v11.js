'use strict';

/**
 * Set Mutah V11 as default and issue current evaluation reports.
 *
 * Usage: node scripts/_mutah-issue-v11.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { inspectTemplateBuffer } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.preflight');
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
const OUT_DIR = path.join(__dirname, '../tmp/mutah-excel98-export');

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
      `V11 is not the signed/stamped official Mutah template (signed=${signed}, stamped=${stamped}, official=${inspection.mutahOfficial})`
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
  return { signed, stamped, mediaCount: inspection.mediaCount, version: 11 };
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
  const defaultTpl = await prisma.field_training_evaluation_templates.findFirst({
    where: { university_id: MUTAH_UNI_ID, is_default: true, archived_at: null },
    select: { id: true, version: true, is_default: true, is_active: true, validation_json: true },
  });
  const samples = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    select: {
      eligibility_status: true,
      template_version: true,
      professional_total: true,
      criterion_1_score: true,
      criterion_6_score: true,
      general_comments: true,
      student: { select: { full_name: true, university_student_number: true } },
    },
    take: 8,
    orderBy: { eligibility_status: 'asc' },
  });
  return { versions, defaultTpl: { ...defaultTpl, validation_json: {
    signed: defaultTpl?.validation_json?.signed,
    stamped: defaultTpl?.validation_json?.stamped,
    officialVersion: defaultTpl?.validation_json?.officialVersion,
  } }, samples };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const activated = await activateV11(user);
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  console.log(JSON.stringify({ phase: 'start', excelStudents: excel.rows.length, activated }, null, 2));

  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: 'MUTAH_V11_OFFICIAL_REPORT_POLICY',
  });
  const zipMeta = await buildZip(user, exportResult, excel.rows);
  const after = await afterState();
  const out = {
    summary: exportResult.summary,
    unmatched: exportResult.unmatched,
    platformExcludedCount: exportResult.platformExcluded?.length || 0,
    technicalFailures: (exportResult.results || []).filter((r) => r.classification === 'FAILED_TECHNICAL'),
    zip: zipMeta,
    after,
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'v11-issue-out.json'), JSON.stringify(out, null, 2), 'utf8');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
