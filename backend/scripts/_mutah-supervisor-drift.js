'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const audits = await prisma.field_training_supervisor_import_audit.findMany({
    where: { opportunity_id: OID, action: { in: ['created', 'updated'] } },
    select: { application_id: true, new_supervisor_name: true },
  });
  const apps = await prisma.field_training_applications.findMany({
    where: { id: { in: audits.map((a) => a.application_id) } },
    select: { id: true, academic_supervisor_name: true },
  });
  const appById = new Map(apps.map((a) => [a.id, a]));
  const drift = audits.filter((a) => {
    const app = appById.get(a.application_id);
    return app && !app.academic_supervisor_name?.trim() && a.new_supervisor_name?.trim();
  });
  console.log(JSON.stringify({ audits: audits.length, drift: drift.length, sample: drift.slice(0, 5) }, null, 2));
  await prisma.$disconnect();
})();
