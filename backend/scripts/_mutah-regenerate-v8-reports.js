'use strict';

/**
 * Regenerate Mutah v8 evaluation PDFs for data-ready students (bounded via renderer queue).
 *
 * Usage:
 *   node scripts/_mutah-regenerate-v8-reports.js
 *   node scripts/_mutah-regenerate-v8-reports.js --apply
 *   node scripts/_mutah-regenerate-v8-reports.js --apply --limit 5
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { getOfficialDocumentRendererStatus } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.renderer');
const { READY_STATUS, GENERATED_STATUS } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');

const APPLY = process.argv.includes('--apply');
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

function argNumber(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return fallback;
  const value = Number(process.argv[idx + 1]);
  return Number.isFinite(value) ? value : fallback;
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

function isDataReady(row) {
  return row.readiness === READY_STATUS || row.readinessCategory === GENERATED_STATUS;
}

async function main() {
  const limit = argNumber('--limit', null);
  const renderer = getOfficialDocumentRendererStatus({ includeExecutable: true, refresh: true });
  const user = await findSuperAdminUser();
  const readiness = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);

  const targets = (readiness.students || []).filter(isDataReady);
  const selected = limit ? targets.slice(0, limit) : targets;

  const plan = {
    mode: APPLY ? 'APPLY' : 'DRY-RUN',
    renderer,
    templateGenerationReady: readiness.templateReadiness?.templateGenerationReady,
    dataReady: readiness.counts?.dataReady,
    finalReady: readiness.counts?.finalReady,
    outdatedArtifacts: readiness.counts?.outdatedArtifacts,
    selectedCount: selected.length,
    selected: selected.map((row) => ({
      applicationId: row.applicationId,
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      eligibilityStatus: row.eligibilityStatus,
      generatedArtifactStatus: row.generatedArtifactStatus,
    })),
  };

  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) return;
  if (!renderer.available) {
    console.error('Renderer unavailable — install LibreOffice first.');
    process.exitCode = 2;
    return;
  }
  if (!readiness.templateReadiness?.templateGenerationReady) {
    console.error('Template generation not ready.');
    process.exitCode = 2;
    return;
  }

  const out = await service.generateForApplications(
    user,
    selected.map((row) => row.applicationId),
    {
      regenerate: true,
      regenerationReason: 'MUTAH_V8_BULK_REGENERATION',
      finalize: true,
    }
  );

  const after = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
  console.log(
    JSON.stringify(
      {
        generation: out.summary,
        generated: out.results.filter((row) => row.generated).length,
        failed: out.results.filter((row) => row.generated === false && !row.reused).length,
        afterCounts: after.counts,
        afterGeneration: after.generation,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
