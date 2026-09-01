'use strict';

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { eligibilityBucket } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.eligibilityReasons');

const OPPORTUNITY_ID = process.env.MUTAH_OPPORTUNITY_ID || '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      training_status: true,
      completion_eligibility_status: true,
    },
    orderBy: { created_at: 'asc' },
  });
  const { byId } = await service.loadBatchContext(apps.map((row) => row.id));
  const skipped = apps.filter((app) => !byId.get(app.id));
  const active = apps.filter((app) => app.training_status !== 'expelled');
  const eligibleActive = active.filter((app) => eligibilityBucket(app) === 'ELIGIBLE');
  const notEligibleActive = active.filter((app) => eligibilityBucket(app) === 'NOT_ELIGIBLE');
  const pendingActive = active.filter((app) => eligibilityBucket(app) === 'PENDING');

  console.log(JSON.stringify({
    approvedTotal: apps.length,
    activeNonExpelled: active.length,
    contextLoadFailed: skipped.length,
    skippedApplicationIds: skipped.map((row) => row.id),
    activeEligible: eligibleActive.length,
    activeNotEligible: notEligibleActive.length,
    activePending: pendingActive.length,
    activeEligiblePlusNotEligible: eligibleActive.length + notEligibleActive.length,
    gapVs100: active.length - 100,
    gapVs104: apps.length - 100,
    hypothesis100Breakdown: {
      expelledExcludedFrom100: apps.length - active.length,
      contextSkipped: skipped.length,
      remainingUnexplained:
        100 - (eligibleActive.length + notEligibleActive.length + pendingActive.length),
    },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
