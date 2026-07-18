/**
 * Phase 2 — Deactivate active program_admin-only users (status → inactive).
 *
 * Defaults to dry-run (no writes).
 *
 * Dry-run:
 *   node scripts/deactivate-program-admin-only-users.js
 *   EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT=2 node scripts/deactivate-program-admin-only-users.js
 *
 * Apply:
 *   EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT=2 APPLY_PROGRAM_ADMIN_DEACTIVATION=true \
 *     node scripts/deactivate-program-admin-only-users.js
 *
 * Rollback dry-run:
 *   PROGRAM_ADMIN_DEACTIVATION_BATCH_ID=<uuid> node scripts/deactivate-program-admin-only-users.js --rollback
 *
 * Rollback apply:
 *   PROGRAM_ADMIN_DEACTIVATION_BATCH_ID=<uuid> APPLY_PROGRAM_ADMIN_DEACTIVATION_ROLLBACK=true \
 *     node scripts/deactivate-program-admin-only-users.js --rollback
 *
 * Never deletes users, user_roles, or the program_admin role.
 * Not wired into npm seed scripts.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const {
  runProgramAdminDeactivation,
  runProgramAdminDeactivationRollback,
  parseExpectedCount,
  isTruthyEnv,
} = require('./lib/programAdminDeactivation');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[program-admin-deactivation] ${msg}`);
}

function printReport(report) {
  // Masked aggregate only — never emails, names, full IDs, or connection strings.
  log(JSON.stringify(report, null, 2));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const isRollback = process.argv.includes('--rollback');

  if (isRollback) {
    const batchId = String(process.env.PROGRAM_ADMIN_DEACTIVATION_BATCH_ID || '').trim();
    const apply = isTruthyEnv(process.env.APPLY_PROGRAM_ADMIN_DEACTIVATION_ROLLBACK);
    const report = await runProgramAdminDeactivationRollback({
      prisma,
      apply,
      batchId,
    });
    printReport(report);
    if (!report.success) process.exitCode = 1;
    return;
  }

  const expectedCount = parseExpectedCount(
    process.env.EXPECTED_PROGRAM_ADMIN_CANDIDATE_COUNT ?? '2'
  );
  const apply = isTruthyEnv(process.env.APPLY_PROGRAM_ADMIN_DEACTIVATION);

  const report = await runProgramAdminDeactivation({
    prisma,
    apply,
    expectedCount,
  });
  printReport(report);
  if (!report.success) process.exitCode = 1;
}

main()
  .catch((err) => {
    log(`FAILED: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
