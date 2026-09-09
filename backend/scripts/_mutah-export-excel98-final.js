'use strict';

/**
 * Export ALL Mutah Excel population evaluation reports (soft missing-data policy).
 *
 * Usage:
 *   node scripts/_mutah-export-excel98-final.js
 *   node scripts/_mutah-export-excel98-final.js --apply
 *   node scripts/_mutah-export-excel98-final.js --apply --zip
 *   node scripts/_mutah-export-excel98-final.js --zip-only
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const {
  parseSupervisorAssignmentWorkbook,
} = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const {
  reconcileZipUniversityNumbers,
  normalizeUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.mutahExcelDelivery');
const { getOfficialDocumentRendererStatus } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.renderer');

const APPLY = process.argv.includes('--apply');
const WRITE_ZIP = process.argv.includes('--zip') || process.argv.includes('--zip-only');
const ZIP_ONLY = process.argv.includes('--zip-only');
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');
const OUT_DIR = path.join(__dirname, '../tmp/mutah-excel98-export');
const SUMMARY_PATH = path.join(OUT_DIR, 'export-summary.json');

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

async function resolveEvaluationId(row) {
  if (row.evaluationId) return row.evaluationId;
  if (!row.applicationId) return null;
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: row.applicationId, is_current: true },
    select: { id: true },
  });
  return current?.id || null;
}

async function buildZipFromResults(user, exportResult, excelRows) {
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const renderer = getOfficialDocumentRendererStatus({ includeExecutable: true, refresh: true });
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);

  console.log(
    JSON.stringify(
      {
        mode: ZIP_ONLY ? 'ZIP-ONLY' : APPLY ? 'APPLY' : 'DRY-RUN',
        officialOutput: 'docx',
        libreOfficeRequired: false,
        renderer,
        excelStudents: excel.rows.length,
      },
      null,
      2
    )
  );

  let exportResult = null;
  if (ZIP_ONLY) {
    if (!fs.existsSync(SUMMARY_PATH)) {
      throw new Error(`Missing ${SUMMARY_PATH}; run --apply first`);
    }
    exportResult = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  } else if (!APPLY) {
    return;
  } else {
    exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
      excelRows: excel.rows,
      regenerate: true,
      regenerationReason: 'MUTAH_EXCEL_98_FINAL_EXPORT',
    });
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(exportResult, null, 2), 'utf8');
  }

  let zipMeta = null;
  if (WRITE_ZIP) {
    zipMeta = await buildZipFromResults(user, exportResult, excel.rows);
  }

  const out = {
    summary: exportResult.summary,
    unmatched: exportResult.unmatched,
    platformExcludedCount: exportResult.platformExcluded?.length || 0,
    zip: zipMeta,
    technicalFailures: (exportResult.results || []).filter((r) => r.classification === 'FAILED_TECHNICAL'),
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'final-out.json'), JSON.stringify(out, null, 2), 'utf8');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
