'use strict';
const { prisma } = require('../src/config/db');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const pendingPre = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: OID,
      status: 'approved',
      training_status: 'pre_assessment_pending',
    },
    select: {
      id: true,
      student_id: true,
      training_status: true,
      completion_eligibility_status: true,
    },
    orderBy: { created_at: 'asc' },
  });
  const students = pendingPre.length
    ? await prisma.users.findMany({
        where: { id: { in: pendingPre.map((row) => row.student_id) } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const byStudent = new Map(students.map((row) => [row.id, row]));
  console.log(JSON.stringify({
    count: pendingPre.length,
    records: pendingPre.map((app) => ({
      applicationId: app.id,
      studentName: byStudent.get(app.student_id)?.full_name,
      email: byStudent.get(app.student_id)?.email,
      training_status: app.training_status,
      completion_eligibility_status: app.completion_eligibility_status,
      classification: 'PRE_ASSESSMENT_PENDING_NOT_IN_LEGACY_100_DENOMINATOR',
    })),
  }, null, 2));
  await prisma.$disconnect();
})();
