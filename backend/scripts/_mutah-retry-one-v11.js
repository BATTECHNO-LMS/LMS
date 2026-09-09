'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

const APPLICATION_ID = '626abd50-c0b3-4760-8056-a1905f901cf9';
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function main() {
  const user = await findSuperAdminUser();
  const out = await service.generateForApplications(user, [APPLICATION_ID], {
    regenerate: true,
    regenerationReason: 'MUTAH_V11_RETRY_P2028',
    finalize: true,
    mutahSoftDelivery: true,
  });
  const notEligible = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true, eligibility_status: 'NOT_ELIGIBLE' },
    select: {
      template_version: true,
      professional_total: true,
      criterion_1_score: true,
      criterion_6_score: true,
      general_comments: true,
      student: { select: { full_name: true, university_student_number: true } },
    },
    take: 5,
  });
  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status', 'is_current'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  console.log(JSON.stringify({ retry: out.summary, retryResults: out.results, notEligible, versions }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
