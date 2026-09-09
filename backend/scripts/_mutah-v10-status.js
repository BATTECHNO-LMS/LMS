'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');

async function main() {
  const uni = await prisma.universities.findFirst({
    where: { OR: [{ name: 'جامعة مؤتة' }, { name: { contains: 'مؤتة' } }] },
    select: { id: true, name: true },
  });
  console.log('university', uni);
  if (!uni) return;

  const templates = await prisma.field_training_evaluation_templates.findMany({
    where: { university_id: uni.id },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      name: true,
      version: true,
      is_default: true,
      is_active: true,
      archived_at: true,
      validation_status: true,
      created_at: true,
    },
  });
  console.log('templates', JSON.stringify(templates, null, 2));

  const opps = await prisma.field_training_opportunities.findMany({
    where: { university_id: uni.id },
    select: { id: true, title: true, evaluation_template_id: true, status: true },
  });
  console.log('opportunities', JSON.stringify(opps, null, 2));

  const currentEvals = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'is_current'],
    where: { university_id: uni.id },
    _count: { _all: true },
  });
  console.log('evalVersions', JSON.stringify(currentEvals, null, 2));

  const currentCount = await prisma.field_training_final_evaluations.count({
    where: { university_id: uni.id, is_current: true },
  });
  const editedComments = await prisma.field_training_final_evaluations.count({
    where: { university_id: uni.id, is_current: true, comments_edited_at: { not: null } },
  });
  console.log({ currentCount, editedComments });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
