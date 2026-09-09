'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');

const MUTAH_UNI_ID = '910ba424-10ec-44d2-8f7f-c68e7ea5e8cb';
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const templates = await prisma.field_training_evaluation_templates.findMany({
    where: { university_id: MUTAH_UNI_ID },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      name: true,
      version: true,
      is_default: true,
      is_active: true,
      archived_at: true,
      validation_status: true,
      original_file_id: true,
      created_at: true,
      validation_json: true,
    },
  });
  console.log(
    JSON.stringify(
      {
        templates: templates.map((t) => ({
          ...t,
          validation_json: t.validation_json
            ? {
                fillMode: t.validation_json.fillMode,
                official: t.validation_json.official,
                officialSha256: t.validation_json.officialSha256,
                signed: t.validation_json.signed,
                stamped: t.validation_json.stamped,
                keys: Object.keys(t.validation_json),
              }
            : null,
        })),
      },
      null,
      2
    )
  );

  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OPPORTUNITY_ID },
    select: { id: true, title: true, evaluation_template_id: true, university_id: true },
  });
  console.log('opportunity', opp);

  if (opp?.evaluation_template_id) {
    const assigned = await prisma.field_training_evaluation_templates.findUnique({
      where: { id: opp.evaluation_template_id },
      select: { id: true, version: true, name: true, is_default: true, is_active: true, original_file_id: true },
    });
    console.log('assigned', assigned);
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
