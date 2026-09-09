'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');

const MUTAH_UNI_ID = '910ba424-10ec-44d2-8f7f-c68e7ea5e8cb';
const KNOWN_OPP = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const known = await prisma.field_training_opportunities.findUnique({
    where: { id: KNOWN_OPP },
    select: {
      id: true,
      title: true,
      university_id: true,
      evaluation_template_id: true,
      status: true,
    },
  });
  console.log('knownOpp', known);

  const byEligibility = await prisma.field_training_opportunity_eligibility.findMany({
    where: { university_id: MUTAH_UNI_ID, is_active: true },
    select: {
      opportunity_id: true,
      field_training_opportunities: {
        select: { id: true, title: true, university_id: true, evaluation_template_id: true, status: true },
      },
    },
  });
  console.log('byEligibility', JSON.stringify(byEligibility, null, 2));

  const evalsByOpp = await prisma.field_training_final_evaluations.groupBy({
    by: ['opportunity_id', 'template_id', 'template_version', 'is_current'],
    where: { university_id: MUTAH_UNI_ID, is_current: true },
    _count: { _all: true },
  });
  console.log('currentEvalsByOpp', JSON.stringify(evalsByOpp, null, 2));

  if (known?.evaluation_template_id) {
    const assigned = await prisma.field_training_evaluation_templates.findUnique({
      where: { id: known.evaluation_template_id },
      select: { id: true, version: true, name: true, is_default: true, is_active: true },
    });
    console.log('assignedTemplate', assigned);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
