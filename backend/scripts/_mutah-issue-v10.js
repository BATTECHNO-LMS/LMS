'use strict';

/**
 * Issue Mutah evaluations on template v10 with the official completion notes.
 *
 * Usage: node scripts/_mutah-issue-v10.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const {
  reconcileZipUniversityNumbers,
  normalizeUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.mutahExcelDelivery');

const MUTAH_UNI_ID = '910ba424-10ec-44d2-8f7f-c68e7ea5e8cb';
const V10_TEMPLATE_ID = '716a4c59-c422-4b90-82fb-66415cc2f573';
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

async function setV10Default() {
  await prisma.$transaction([
    prisma.field_training_evaluation_templates.updateMany({
      where: { university_id: MUTAH_UNI_ID, is_default: true, archived_at: null },
      data: { is_default: false, updated_at: new Date() },
    }),
    prisma.field_training_evaluation_templates.update({
      where: { id: V10_TEMPLATE_ID },
      data: { is_default: true, is_active: true, updated_at: new Date() },
    }),
    prisma.field_training_opportunities.update({
      where: { id: OPPORTUNITY_ID },
      data: { evaluation_template_id: V10_TEMPLATE_ID, updated_at: new Date() },
    }),
  ]);
}

async function resolveEvaluationId(row) {
  if (row.evaluationId) return row.evaluationId;
  if (!row.applicationId) return null;
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: row.applicationId, is_current: true },
    select: { id: true, template_version: true, general_comments: true },
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
    by: ['template_version', 'is_current'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const sample = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true, eligibility_status: 'ELIGIBLE' },
    select: { general_comments: true, template_version: true, student: { select: { full_name: true, university_student_number: true } } },
    take: 3,
  });
  const defaultTpl = await prisma.field_training_evaluation_templates.findFirst({
    where: { university_id: MUTAH_UNI_ID, is_default: true, archived_at: null },
    select: { id: true, version: true, is_default: true },
  });
  return { versions, sample, defaultTpl };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await setV10Default();
  const user = await findSuperAdminUser();
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);

  console.log(JSON.stringify({ phase: 'start', excelStudents: excel.rows.length, template: 'v10' }, null, 2));

  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: 'MUTAH_V10_OFFICIAL_NOTES',
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
  fs.writeFileSync(path.join(OUT_DIR, 'v10-issue-out.json'), JSON.stringify(out, null, 2), 'utf8');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
