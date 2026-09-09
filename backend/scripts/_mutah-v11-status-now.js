'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OPPORTUNITY_ID },
    select: { evaluation_template_id: true, title: true },
  });
  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status', 'is_current'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const apps = await prisma.field_training_applications.groupBy({
    by: ['completion_eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    _count: { _all: true },
  });
  const letters = await prisma.field_training_completion_letters.groupBy({
    by: ['status'],
    where: { opportunity_id: OPPORTUNITY_ID },
    _count: { _all: true },
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
  const failedEvals = await prisma.field_training_final_evaluations.count({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true, filled_docx_file_id: null },
  });
  const latestJob = await prisma.field_training_completion_letter_jobs.findFirst({
    where: { opportunity_id: OPPORTUNITY_ID },
    orderBy: { created_at: 'desc' },
    select: { id: true, status: true, progress: true, error_message: true, created_at: true, finished_at: true },
  });
  console.log(
    JSON.stringify(
      { opp, versions, apps, letters, notEligibleLetters, failedEvals, latestJob },
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
