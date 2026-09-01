'use strict';
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OID, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      training_status: true,
      completion_eligibility_status: true,
    },
  });
  const byTraining = {};
  for (const app of apps) {
    byTraining[app.training_status] = (byTraining[app.training_status] || 0) + 1;
  }
  const notInEligiblePlusIneligible = apps.filter(
    (app) => !['eligible', 'ineligible'].includes(app.completion_eligibility_status)
  );
  console.log(JSON.stringify({ byTraining, notInEligiblePlusIneligible }, null, 2));
  await prisma.$disconnect();
})();
