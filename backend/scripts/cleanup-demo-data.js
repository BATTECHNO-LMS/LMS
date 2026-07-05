/**
 * Safe demo/test data cleanup for BATTECHNO LMS.
 *
 * Deletes ONLY records with clear demo markers (analytics demo, BATTECHNO seed,
 * Tafila demo, demo email domains, demo slugs/prefixes).
 *
 * NEVER deletes:
 * - roles / permissions
 * - universities marked real_baseline=true (e.g. جامعة مؤتة)
 * - unknown/unmarked data
 *
 * Usage:
 *   node scripts/cleanup-demo-data.js              # dry-run preview
 *   node scripts/cleanup-demo-data.js --confirm-clean-demo
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { previewDemoCleanup, runDemoCleanup, log } = require('./lib/demoCleanup');

const CONFIRM_FLAG = '--confirm-clean-demo';
const FORCE_PROD_FLAG = '--allow-production';

function assertSafeToRun() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
  if (process.env.NODE_ENV === 'production' && !process.argv.includes(FORCE_PROD_FLAG)) {
    throw new Error(
      'Refusing to run in production without --allow-production. Pass --confirm-clean-demo --allow-production only if you are certain.'
    );
  }
  if (!process.argv.includes(CONFIRM_FLAG)) {
    log('DRY RUN — pass --confirm-clean-demo to delete demo data.');
  }
}

function printPreview({ plan, protectedUniversities }) {
  log('Protected real baseline universities (will NOT be deleted):');
  if (!protectedUniversities.length) {
    log('  (none found — run npm run seed:real-baseline after cleanup)');
  } else {
    for (const u of protectedUniversities) {
      log(`  • ${u.name} (${u.id})`);
    }
  }

  log('Demo universities to delete:');
  if (!plan.demoUniversities.length) log('  (none)');
  for (const u of plan.demoUniversities) log(`  • ${u.name} (${u.id})`);

  log('Demo users sample (up to 10):');
  for (const u of plan.demoUsers.slice(0, 10)) log(`  • ${u.email}`);
  if (plan.demoUsers.length > 10) log(`  … and ${plan.demoUsers.length - 10} more`);

  log('Planned deletion counts:');
  for (const [key, value] of Object.entries(plan.counts)) {
    log(`  ${key}: ${value}`);
  }
}

async function main() {
  assertSafeToRun();
  const preview = await previewDemoCleanup();
  printPreview(preview);

  if (!process.argv.includes(CONFIRM_FLAG)) {
    log('No changes made (dry run).');
    return;
  }

  log('Deleting demo data…');
  const { deleted, plan } = await runDemoCleanup();
  log('Deletion complete.');
  for (const [key, value] of Object.entries(deleted)) {
    if (value != null) log(`  deleted ${key}: ${value}`);
  }
  if (!Object.keys(deleted).length && !plan.counts.universities) {
    log('Nothing was deleted.');
  }
}

main()
  .catch((err) => {
    log(`FAILED: ${err.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
