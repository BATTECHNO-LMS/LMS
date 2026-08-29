'use strict';

/**
 * Inspect / publish the standardized field-training post-assessment
 * (FIELD_TRAINING_POST_ASSESSMENT_FULLSTACK_2026_V1) onto every attachable opportunity.
 *
 * Usage:
 *   node scripts/publish-field-training-post-assessment.js           # dry-run
 *   node scripts/publish-field-training-post-assessment.js --apply  # write + notify
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const {
  applyToAllOpportunities,
  TEMPLATE_ID,
  ASSESSMENT_TITLE,
  OPENS_AT,
  TIMEZONE,
} = require('../src/modules/fieldTraining/fieldTraining.standardizedPostAssessment');

const APPLY = process.argv.includes('--apply');

function printReport(report) {
  console.log(JSON.stringify({
    template_id: TEMPLATE_ID,
    title: ASSESSMENT_TITLE,
    apply: report.apply,
    opportunities_found: report.opportunitiesFound,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    skipped_count: report.skippedCount,
    eligible_students: report.eligibleStudents,
    opens_at: report.opensAt || OPENS_AT,
    timezone: report.timezone || TIMEZONE,
    assessments: report.assessments,
    dry_run_targets: report.dryRunTargets,
    bank: report.bank,
  }, null, 2));
}

async function main() {
  const report = await applyToAllOpportunities({ apply: APPLY, notify: true });
  printReport(report);
  if (!APPLY) {
    console.error('\nDry-run only. Re-run with --apply to publish.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
