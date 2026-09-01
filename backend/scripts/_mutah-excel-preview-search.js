'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const TARGETS = new Set(['120252222134', '120252222154', '120212212023', '120232222041', '120252222116']);
(async () => {
  const batches = await prisma.field_training_supervisor_import_batches.findMany({
    where: { opportunity_id: OID },
    orderBy: { created_at: 'desc' },
  });
  const hits = [];
  for (const batch of batches) {
    const groups = batch.preview_json?.groups || [];
    for (const group of groups) {
      for (const student of group.students || []) {
        const num = String(student.university_number || student.universityNumber || '');
        if (TARGETS.has(num)) {
          hits.push({
            batchId: batch.id,
            status: batch.status,
            num,
            name: student.student_name,
            proposed: student.proposed_supervisor_name,
            applicationId: student.application_id,
            errors: student.errors,
          });
        }
      }
    }
  }
  console.log(JSON.stringify(hits, null, 2));
  await prisma.$disconnect();
})();
