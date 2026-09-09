'use strict';

require('dotenv').config();
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

const FAILED_IDS = [
  '1dedb75e-083d-428c-a148-dbee5f70bd0f',
  '8f397c22-2501-4024-aec2-35e3b65aac68',
  '7561c35f-4126-4273-a2b2-443682d958e6',
  '45460603-775d-4836-a461-1d35c00b17fa',
  '113d0383-2b21-434c-aee9-cdb59a5dc4fb',
  '6d453401-dc73-4a0e-b54f-429d6ff02d56',
  '74cd47ed-8bdd-4c6f-966a-c9082cb9f989',
  'c90cac36-7be9-41e2-bf61-de9fc53a1ca2',
  'efe5e9de-1736-4bc0-8be7-3a04819e9a5e',
  'cf3af10e-11f0-4b36-95d1-98ad1653d36b',
  '961b8622-60a9-4c04-bb77-eaac730afb98',
];
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

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
  const gen = await service.generateForApplications(user, FAILED_IDS, {
    regenerate: true,
    regenerationReason: 'MUTAH_V11_FINAL_EVALUATION_RULES',
    finalize: true,
    mutahSoftDelivery: true,
  });
  const current = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true, template_version: 11 },
    select: {
      eligibility_status: true,
      professional_total: true,
      criterion_1_score: true,
      general_comments: true,
      score_evidence_json: true,
    },
  });
  const daysWrong = current.filter(
    (row) => Number(row.score_evidence_json?.templatePayload?.training_days) !== 45
  );
  const notEligibleWrong = current.filter(
    (row) =>
      row.eligibility_status === 'NOT_ELIGIBLE' &&
      (Number(row.professional_total) !== 10 || Number(row.criterion_1_score) !== 1)
  );
  const pageWrong = current.filter((row) => Number(row.score_evidence_json?.generatedPageCount) !== 2);
  const eligibleFormal = current.filter(
    (row) =>
      row.eligibility_status === 'ELIGIBLE' &&
      /التقييم القبلي/.test(row.general_comments || '') &&
      /البعدي/.test(row.general_comments || '') &&
      /التسليمات/.test(row.general_comments || '') &&
      /الحضور/.test(row.general_comments || '') &&
      /الساعات/.test(row.general_comments || '')
  );
  const notEligibleComments = current.filter(
    (row) => row.eligibility_status === 'NOT_ELIGIBLE' && /غير مؤهل/.test(row.general_comments || '')
  );
  console.log(
    JSON.stringify(
      {
        retry: gen.results.map((row) => ({
          applicationId: row.applicationId,
          generated: row.generated,
          classification: row.classification,
          code: row.code,
          pageCount: row.pageCount,
          eligibilityStatus: row.eligibilityStatus,
        })),
        qa: {
          v11: current.length,
          eligible: current.filter((row) => row.eligibility_status === 'ELIGIBLE').length,
          notEligible: current.filter((row) => row.eligibility_status === 'NOT_ELIGIBLE').length,
          daysWrong: daysWrong.length,
          notEligibleWrong: notEligibleWrong.length,
          pageWrong: pageWrong.length,
          eligibleFormal: eligibleFormal.length,
          notEligibleComments: notEligibleComments.length,
        },
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
