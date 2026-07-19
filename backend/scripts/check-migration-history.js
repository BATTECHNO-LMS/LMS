/**
 * Fail-closed readiness check for production-like Prisma migration deploy.
 * Does NOT mark migrations applied. Does NOT run deploy.
 *
 * Exit 0: history table exists, no failed rows, prints applied/pending summary.
 * Exit 2: history missing or failed migrations present (operator must stop).
 * Exit 1: unexpected error.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const p = new PrismaClient();

function listRepoMigrations() {
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

async function main() {
  const repo = listRepoMigrations();
  let historyExists = false;
  let rows = [];

  try {
    rows = await p.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at, logs
      FROM "_prisma_migrations"
      ORDER BY started_at
    `);
    historyExists = true;
  } catch (e) {
    const msg = String(e.message || e);
    if (/does not exist|42P01/i.test(msg)) {
      console.error(
        [
          'MIGRATION HISTORY INCONSISTENT (P3005-class).',
          'Table "_prisma_migrations" is missing on a non-empty or unbaselined database.',
          'Do NOT run prisma db push, migrate reset, or auto-resolve unknown migrations.',
          'Follow docs/maintenance/16_PRISMA_MIGRATION_BASELINE_AUDIT.md and 17_PRISMA_MIGRATION_RECONCILIATION.md.',
          'Next: prisma migrate status → audited resolve/deploy only.',
        ].join('\n')
      );
      process.exit(2);
    }
    throw e;
  }

  const failed = rows.filter((r) => r.finished_at == null || r.rolled_back_at != null);
  const applied = new Set(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name));
  const pending = repo.filter((name) => !applied.has(name));

  console.log(
    JSON.stringify(
      {
        history_exists: historyExists,
        repo_migration_count: repo.length,
        history_row_count: rows.length,
        applied_count: applied.size,
        pending_count: pending.length,
        pending,
        failed_count: failed.length,
        failed: failed.map((f) => f.migration_name),
      },
      null,
      2
    )
  );

  if (failed.length) {
    console.error(
      [
        'MIGRATION HISTORY INCONSISTENT.',
        'One or more migrations failed or were rolled back in "_prisma_migrations".',
        'Do NOT continue with blind deploy. Inspect failed rows, fix SQL, then prisma migrate resolve as documented.',
        'Forbidden: migrate reset, db push, deleting history rows without review.',
      ].join('\n')
    );
    process.exit(2);
  }

  if (pending.length) {
    console.log(
      `Pending migrations require explicit SQL review before: npx prisma migrate deploy\n${pending.join('\n')}`
    );
  } else {
    console.log('Migration history consistent: no pending migrations.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
