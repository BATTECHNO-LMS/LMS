'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const suspects = [
  'specialties',
  'email_verification_otps',
  'password_reset_otps',
  'files',
  'university_specialties',
  'field_training_opportunity_eligibility',
  'field_training_sessions',
  'field_training_attendance',
  'field_training_assessments',
  'field_training_assessment_questions',
  'field_training_assessment_attempts',
  'field_training_completion_letters',
];

const indexes = [
  'idx_field_training_opportunities_university',
  'specialties_code_key',
  'idx_field_training_applications_opportunity',
  'idx_university_email_domains_domain',
  'uq_ft_opportunity_eligibility',
  'files_storage_key_key',
];

const columns = [
  ['field_training_opportunities', 'university_id'],
  ['field_training_opportunities', 'specialty_id'],
  ['users', 'specialty_id'],
  ['users', 'email_verified_at'],
  ['users', 'university_specialty_id'],
  ['field_training_tasks', 'instruction_file_path'],
  ['field_training_task_submissions', 'ai_evaluated_at'],
  ['field_training_task_submissions', 'project_url'],
  ['field_training_assessment_questions', 'is_required'],
  ['field_training_assessment_attempts', 'grading_details'],
  ['field_training_opportunities', 'training_started_at'],
  ['field_training_applications', 'eligibility_reason'],
];

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY 1
  `;
  const tableSet = new Set(tables.map((t) => t.table_name));

  const idx = await prisma.$queryRaw`SELECT indexname FROM pg_indexes WHERE schemaname='public'`;
  const idxSet = new Set(idx.map((i) => i.indexname));

  const cols = await prisma.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'
  `;
  const colSet = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));

  const enums = await prisma.$queryRaw`
    SELECT t.typname FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype='e' ORDER BY 1
  `;

  console.log(
    JSON.stringify(
      {
        all_tables: [...tableSet],
        suspect_tables: Object.fromEntries(suspects.map((t) => [t, tableSet.has(t)])),
        suspect_indexes: Object.fromEntries(indexes.map((i) => [i, idxSet.has(i)])),
        suspect_columns: Object.fromEntries(
          columns.map(([t, c]) => [`${t}.${c}`, colSet.has(`${t}.${c}`)])
        ),
        enums: enums.map((e) => e.typname),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
