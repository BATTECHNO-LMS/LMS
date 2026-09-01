'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const ftRepo = require('../src/modules/fieldTraining/fieldTraining.repository');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
(async () => {
  const user = await prisma.users.findFirst({ where: { email: 'student@batuni.edu' }, select: { id: true, full_name: true, email: true, primary_university_id: true } });
  const app = user
    ? await prisma.field_training_applications.findFirst({
        where: { opportunity_id: OID, student_id: user.id, status: 'approved' },
        select: { id: true, training_status: true, completion_eligibility_status: true, academic_supervisor_name: true },
      })
    : null;
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OID },
    include: {
      field_training_opportunity_eligibility: { where: { is_active: true }, select: { university_id: true } },
    },
  });
  console.log(JSON.stringify({ user, app, oppUniversities: opp?.field_training_opportunity_eligibility?.map((r) => r.university_id), oppUniversityId: opp?.university_id }, null, 2));
  await prisma.$disconnect();
})();
