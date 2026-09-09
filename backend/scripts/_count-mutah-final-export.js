'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');

(async () => {
  const n = await prisma.field_training_final_evaluations.count({
    where: {
      opportunity_id: '6c8783ec-49fd-428e-83e2-8b65e52c3b4f',
      is_current: true,
      regeneration_reason: 'MUTAH_EXCEL_98_FINAL_EXPORT',
    },
  });
  const latest = await prisma.field_training_final_evaluations.findFirst({
    where: {
      opportunity_id: '6c8783ec-49fd-428e-83e2-8b65e52c3b4f',
      is_current: true,
    },
    orderBy: { generated_at: 'desc' },
    select: { generated_at: true, regeneration_reason: true, eligibility_status: true },
  });
  console.log(JSON.stringify({ regeneratedWithFinalExportReason: n, latest }, null, 2));
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
