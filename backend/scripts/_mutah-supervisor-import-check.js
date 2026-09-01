'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const batches = await prisma.field_training_supervisor_import_batches.findMany({
    where: { opportunity_id: OID },
    select: { id: true, original_filename: true, status: true, created_at: true, preview_json: true },
    orderBy: { created_at: 'desc' },
    take: 3,
  });
  const audits = await prisma.field_training_supervisor_import_audit.count({ where: { opportunity_id: OID } });
  console.log(JSON.stringify({ batchCount: batches.length, audits, latestStatus: batches[0]?.status, previewRows: batches[0]?.preview_json?.students?.length || batches[0]?.preview_json?.rows?.length || null }, null, 2));
  await prisma.$disconnect();
})();
