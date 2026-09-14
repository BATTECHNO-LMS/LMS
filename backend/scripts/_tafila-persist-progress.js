'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: '4d9466cb-127b-42f2-ac08-88e7fcc7c7df', status: 'approved' },
    select: { completion_eligibility_status: true, eligibility_reason: true },
  });
  const withPolicy = apps.filter(
    (row) => row.eligibility_reason?.details?.policyCode === 'TAFILA_SCORING_POLICY_20_20_40_20_V1'
  ).length;
  const eligible = apps.filter((row) => row.completion_eligibility_status === 'eligible').length;
  const ineligible = apps.filter((row) => row.completion_eligibility_status === 'ineligible').length;
  const needs = apps.filter((row) => row.completion_eligibility_status === 'needs_review').length;
  const evals = await prisma.field_training_final_evaluations.count({
    where: {
      opportunity_id: '4d9466cb-127b-42f2-ac08-88e7fcc7c7df',
      regeneration_reason: 'TAFILA_SCORING_POLICY_20_20_40_20_V1',
    },
  });
  console.log(JSON.stringify({ total: apps.length, withPolicy, eligible, ineligible, needs, evals }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
