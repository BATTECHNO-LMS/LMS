require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const counts = await p.$queryRawUnsafe(`
    SELECT 'submissions' AS t, COUNT(*)::int AS c FROM submissions
    UNION ALL SELECT 'users', COUNT(*)::int FROM users
    UNION ALL SELECT 'grades', COUNT(*)::int FROM grades
    UNION ALL SELECT 'field_training_opportunities', COUNT(*)::int FROM field_training_opportunities
    UNION ALL SELECT 'assessments', COUNT(*)::int FROM assessments
  `);
  console.log('counts', JSON.stringify(counts));
  const idx = await p.$queryRawUnsafe(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_submissions_assessment_student'
  `);
  console.log('index', JSON.stringify(idx));
  const hist = await p.$queryRawUnsafe(`
    SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
    FROM _prisma_migrations
    ORDER BY finished_at NULLS LAST, migration_name
  `);
  console.log('history_count', hist.length);
  console.log('history', JSON.stringify(hist.map((h) => h.migration_name)));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
