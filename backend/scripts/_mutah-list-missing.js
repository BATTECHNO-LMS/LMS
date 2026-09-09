'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

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
  const readiness = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
  const students = readiness.students || [];
  const missing = students.filter(
    (s) =>
      s.readiness === 'MISSING_REQUIRED_DATA' ||
      !s.generated ||
      s.generatedArtifactStatus !== 'CURRENT_TEMPLATE'
  );
  console.log(
    JSON.stringify(
      {
        counts: readiness.counts,
        missingCount: missing.length,
        missing: missing.map((s) => ({
          name: s.studentName,
          num: s.universityNumber,
          app: s.applicationId,
          elig: s.eligibilityStatus,
          cat: s.readinessCategory,
          art: s.generatedArtifactStatus,
          static: s.staticMissingFields,
          prof: s.professionalMissingFields,
          fields: s.missingFields,
          details: s.missingFieldDetails,
          supervisor: s.academicSupervisorName,
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
    await prisma.$disconnect().catch(() => {});
  });
