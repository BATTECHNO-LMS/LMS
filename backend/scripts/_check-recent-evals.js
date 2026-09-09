'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
(async () => {
  const rows = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: '6c8783ec-49fd-428e-83e2-8b65e52c3b4f', is_current: true },
    orderBy: { generated_at: 'desc' },
    take: 8,
    select: {
      id: true,
      generated_at: true,
      regeneration_reason: true,
      eligibility_status: true,
    },
  });
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
