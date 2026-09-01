'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const o = await prisma.field_training_opportunities.findUnique({
    where: { id: OID },
    include: {
      field_training_opportunity_eligibility: { where: { is_active: true }, select: { university_id: true } },
    },
  });
  console.log(JSON.stringify(o, null, 2));
  await prisma.$disconnect();
})();
