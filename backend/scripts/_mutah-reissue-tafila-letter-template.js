'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { buildOfficialCompletionLetterHtml } = require('../src/modules/fieldTraining/fieldTraining.completionLetter.template');

const MUTAH_OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

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
  const user = await findSuperAdminUser();
  const preview = await letterService.previewBulkIssue(MUTAH_OPPORTUNITY_ID, user, {
    forceRegenerate: true,
  });
  const sampleHtml = buildOfficialCompletionLetterHtml({
    letterNo: 'FT-MUTAH-TEMPLATE',
    studentName: 'عينة',
    universityNumber: '120232221002',
    universityName: 'جامعة مؤتة',
    specialtyName: 'أمن المعلومات',
    opportunityTitle: 'التدريب الميداني الصيفي لطلبة جامعة مؤتة 2025/2026',
    startDate: '2026-07-23',
    endDate: '2026-09-05',
    completedHours: 140,
    issuedAt: new Date().toISOString().slice(0, 10),
  });
  const templateCheck = {
    title: /كتاب إنهاء تدريب ميداني/.test(sampleHtml),
    rtl: /dir="rtl"/.test(sampleHtml),
    signatory: /عاصم القيسي/.test(sampleHtml),
    stampCss: /class="stamp"/.test(sampleHtml),
    font: /Sakkal Majalla/.test(sampleHtml),
  };

  if (!preview.letters_to_issue) {
    console.log(
      JSON.stringify(
        {
          issued: false,
          reason: 'NO_ELIGIBLE_STUDENTS',
          preview: {
            eligible: preview.eligible,
            letters_to_issue: preview.letters_to_issue,
            notEligibleExcluded: preview.notEligibleExcluded,
            alreadyCurrent: preview.alreadyCurrent,
          },
          templateCheck,
        },
        null,
        2
      )
    );
    return;
  }

  const job = await letterService.startBulkIssue(MUTAH_OPPORTUNITY_ID, user, {
    sync: true,
    forceRegenerate: true,
  });
  const letters = await prisma.field_training_completion_letters.groupBy({
    by: ['status'],
    where: { opportunity_id: MUTAH_OPPORTUNITY_ID },
    _count: { _all: true },
  });
  const notEligibleLetters = await prisma.field_training_completion_letters.count({
    where: {
      opportunity_id: MUTAH_OPPORTUNITY_ID,
      status: 'issued',
      field_training_applications: { completion_eligibility_status: { not: 'eligible' } },
    },
  });
  console.log(
    JSON.stringify(
      {
        issued: true,
        templateCheck,
        preview: {
          eligible: preview.eligible,
          letters_to_issue: preview.letters_to_issue,
          notEligibleExcluded: preview.notEligibleExcluded,
        },
        job: {
          id: job.id,
          status: job.status,
          progress: job.progress,
        },
        letters,
        notEligibleLetters,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    console.error(JSON.stringify(err.details || null, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
