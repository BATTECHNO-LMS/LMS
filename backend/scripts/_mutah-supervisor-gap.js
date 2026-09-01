'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OID, status: 'approved' },
    select: { id: true, student_id: true, academic_supervisor_name: true, completion_eligibility_status: true },
  });
  const assignments = await prisma.field_training_academic_supervisor_assignments.findMany({
    where: { opportunity_id: OID },
    select: { application_id: true, academic_supervisor_name: true },
  });
  const assignByApp = new Map(assignments.map((row) => [row.application_id, row.academic_supervisor_name]));
  const missingName = apps.filter((app) => !app.academic_supervisor_name?.trim());
  const recoverable = missingName.filter((app) => assignByApp.get(app.id)?.trim());
  console.log(JSON.stringify({
    approved: apps.length,
    missingSupervisorOnApp: missingName.length,
    recoverableFromAssignments: recoverable.length,
    eligibleMissingSupervisor: missingName.filter((a) => a.completion_eligibility_status === 'eligible').length,
  }, null, 2));
  await prisma.$disconnect();
})();
