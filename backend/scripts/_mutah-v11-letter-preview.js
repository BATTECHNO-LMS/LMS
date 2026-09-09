'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const APP_ID = '1d3801c4-18ff-494e-8e3a-ce39e8ed03d7';

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return { userId: rows[0].id, roles: ['super_admin'], isGlobal: true, universityId: null };
}

async function main() {
  const letter = await prisma.field_training_completion_letters.findFirst({
    where: { application_id: APP_ID },
    select: { id: true, status: true, pdf_url: true, letter_no: true, issued_at: true },
  });
  const preview = await letterService.previewBulkIssue(OPPORTUNITY_ID, await findSuperAdminUser(), {});
  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const letters = await prisma.field_training_completion_letters.groupBy({
    by: ['status'],
    where: { opportunity_id: OPPORTUNITY_ID },
    _count: { _all: true },
  });
  console.log(
    JSON.stringify(
      {
        ahmadLetter: letter,
        preview: {
          total: preview.total_students,
          eligible: preview.eligible,
          letters_to_issue: preview.letters_to_issue,
          notEligibleExcluded: preview.notEligibleExcluded,
          alreadyCurrent: preview.alreadyCurrent,
          skipped: preview.skipped,
        },
        versions,
        letters,
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
