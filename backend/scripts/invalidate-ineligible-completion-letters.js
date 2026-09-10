'use strict';

/**
 * Non-destructive remediation of completion letters issued to currently ineligible students.
 *
 *   node scripts/invalidate-ineligible-completion-letters.js
 *   node scripts/invalidate-ineligible-completion-letters.js --apply
 *
 * Does not delete letter rows or PDF files. Marks issued letters as revoked.
 */

const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/config/db');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');

async function main() {
  const apply = process.argv.includes('--apply');
  const report = await letterService.remediateIneligibleCompletionLetters({
    dryRun: !apply,
    actorUserId: null,
  });
  const outDir = path.join(__dirname, '../../qa-artifacts/field-training');
  fs.mkdirSync(path.join(outDir, 'logs'), { recursive: true });
  const file = path.join(
    outDir,
    'logs',
    apply ? 'ineligible-letters-after.json' : 'ineligible-letters-before.json'
  );
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        dryRun: report.dryRun,
        beforeCount: report.beforeCount,
        afterCount: report.afterCount,
        reportFile: file,
        sample: (report.before || []).slice(0, 10).map((row) => ({
          letterNo: row.letterNo,
          applicationId: row.applicationId,
          eligibility: row.eligibility,
          trainingStatus: row.trainingStatus,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
