'use strict';
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const byStatus = await prisma.field_training_applications.groupBy({
    by: ['status'],
    where: { opportunity_id: OID },
    _count: true,
  });
  const notApproved = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OID, status: { not: 'approved' } },
    select: { id: true, status: true, training_status: true, completion_eligibility_status: true },
  });
  console.log(JSON.stringify({ byStatus, notApproved }, null, 2));
  await prisma.$disconnect();
})();
