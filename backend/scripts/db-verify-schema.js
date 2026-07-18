/**
 * Verify key schema objects after empty init or deploy.
 * Read-only. Safe against any DATABASE_URL (does not mutate).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const REQUIRED_TABLES = [
  'users',
  'roles',
  'universities',
  'sessions',
  'cohorts',
  'assessments',
  'submissions',
  'grades',
  'attendance_records',
  'field_training_opportunities',
  'field_training_applications',
  'specialties',
  'files',
  'email_verification_otps',
  'password_reset_otps',
  '_prisma_migrations',
];

const REQUIRED_ENUMS = [
  'attendance_status',
  'user_status',
  'enrollment_status',
  'assessment_status',
  'submission_status',
  'field_training_application_status',
];

async function main() {
  const p = new PrismaClient();
  try {
    const tables = await p.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1
    `);
    const tableSet = new Set(tables.map((t) => t.tablename));
    const missingTables = REQUIRED_TABLES.filter((t) => !tableSet.has(t));

    const enums = await p.$queryRawUnsafe(`
      SELECT t.typname AS name
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
      ORDER BY 1
    `);
    const enumSet = new Set(enums.map((e) => e.name));
    const missingEnums = REQUIRED_ENUMS.filter((e) => !enumSet.has(e));

    const idx = await p.$queryRawUnsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'uq_submissions_assessment_student'
    `);

    const hist = await p.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `);

    const report = {
      public_table_count: tables.length,
      applied_migration_count: hist[0].c,
      missing_tables: missingTables,
      missing_enums: missingEnums,
      unique_submission_index: idx[0] || null,
      ok:
        missingTables.length === 0 &&
        missingEnums.length === 0 &&
        idx.length === 1 &&
        hist[0].c > 0,
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(2);
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
