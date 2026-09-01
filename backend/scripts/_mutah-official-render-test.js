'use strict';

/**
 * One-student official Mutah DOCX → PDF render test.
 * Usage: node scripts/_mutah-official-render-test.js [--application-id <uuid>]
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { getOfficialDocumentRendererStatus } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.renderer');
const { officialTemplatePath, sha256File } = require('./lib/mutahOfficialEvaluationTemplate');
const pdfParse = require('pdf-parse');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const DEFAULT_APP_ID = 'f56fb447-af1e-4a00-9f43-27cdd1ca5274'; // Omar Madadha — data-ready

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin user found');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function main() {
  const applicationId = argValue('--application-id') || DEFAULT_APP_ID;
  const renderer = getOfficialDocumentRendererStatus({ includeExecutable: true, refresh: true });
  const officialSha = sha256File(officialTemplatePath());

  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OPPORTUNITY_ID },
    include: { evaluation_template: true },
  });

  const user = await findSuperAdminUser();
  const readiness = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
  const student = (readiness.students || []).find((row) => row.applicationId === applicationId);

  const result = await service.generateOne(user, applicationId, {
    regenerate: true,
    regenerationReason: 'OFFICIAL_RENDER_TEST',
    finalize: true,
  });

  let pageCount = null;
  let pdfSize = 0;
  if (result?.evaluationId) {
    const row = await prisma.field_training_final_evaluations.findUnique({
      where: { id: result.evaluationId },
      select: { pdf_file_id: true, score_evidence_json: true, template_version: true },
    });
    const file = row?.pdf_file_id
      ? await prisma.files.findFirst({ where: { id: row.pdf_file_id, deleted_at: null } })
      : null;
    if (file) {
      const { getProvider } = require('../src/shared/storage/storageProvider');
      const buffer = await getProvider().getObjectBuffer(file.storage_key);
      pdfSize = buffer.length;
      const parsed = await pdfParse(buffer);
      pageCount = parsed.numpages;
    }
  }

  const outDir = path.join(__dirname, '..', 'tmp', 'mutah-render-test');
  await fs.promises.mkdir(outDir, { recursive: true });
  const reportPath = path.join(outDir, `render-test-${applicationId}.json`);
  const summary = {
    timestamp: new Date().toISOString(),
    opportunityId: OPPORTUNITY_ID,
    applicationId,
    studentName: student?.studentName || null,
    universityNumber: student?.universityNumber || null,
    templateVersion: opp?.evaluation_template?.version,
    officialTemplateSha256: officialSha,
    renderer,
    generateResult: result,
    pdfSize,
    pageCount,
    visualQa: 'VISUAL_QA_BLOCKED',
    pass: Boolean(renderer.available && pdfSize > 0 && pageCount === 2),
  };
  await fs.promises.writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (!renderer.available) {
    console.error('\nRenderer unavailable. Install LibreOffice or set LIBREOFFICE_PATH.');
    process.exitCode = 2;
  }
  if (!summary.pass) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
