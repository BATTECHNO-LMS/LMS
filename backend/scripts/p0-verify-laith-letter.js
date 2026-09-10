'use strict';

const { prisma } = require('../src/config/db');
const official = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');

const LAITH_APP = 'c8ca4e24-65f0-4a0e-96e0-6042042c7556';

async function main() {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: LAITH_APP },
    select: {
      training_status: true,
      completion_eligibility_status: true,
      completion_letter_issued_at: true,
    },
  });
  const letters = await prisma.field_training_completion_letters.findMany({
    where: { application_id: appId },
    select: { id: true, letter_no: true, status: true, pdf_url: true, issued_at: true },
  });
  const result = await official.resolveFieldTrainingApprovedResult(LAITH_APP);
  const ineligibleIds = (
    await prisma.field_training_applications.findMany({
      where: { completion_eligibility_status: 'ineligible' },
      select: { id: true },
    })
  ).map((row) => row.id);
  const remainingIssuedForIneligible = ineligibleIds.length
    ? await prisma.field_training_completion_letters.count({
        where: { status: 'issued', application_id: { in: ineligibleIds } },
      })
    : 0;
  console.log(
    JSON.stringify(
      {
        laithApp: app,
        letters,
        official: {
          eligibility: result.eligibility,
          finalScore: result.finalScore,
          submittedTaskCount: result.submittedTaskCount,
          requiredTaskCount: result.requiredTaskCount,
          trainingStatus: result.trainingStatus,
        },
        remainingIssuedForIneligible,
      },
      null,
      2
    )
  );
}

const appId = LAITH_APP;

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
