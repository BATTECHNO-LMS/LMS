'use strict';
require('dotenv').config();
const { prisma } = require('../src/config/db');
const { resolveOfficialUniversityNumber } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.universityNumber');
const ftRepo = require('../src/modules/fieldTraining/fieldTraining.repository');
const OID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const TARGETS = ['120252222134', '120252222154', '120212212023', '120232222041'];
(async () => {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OID, status: 'approved' },
    select: { id: true, student_id: true, academic_supervisor_name: true },
  });
  const students = await ftRepo.findStudentProfilesByIds(apps.map((a) => a.student_id));
  const byStudent = new Map(students.map((s) => [s.id, s]));
  const missing = [];
  for (const app of apps) {
    const student = byStudent.get(app.student_id);
    const num = resolveOfficialUniversityNumber(student).number;
    if (!app.academic_supervisor_name?.trim()) {
      missing.push({ applicationId: app.id, name: student?.full_name, num, email: student?.email });
    }
  }
  const audits = await prisma.field_training_supervisor_import_audit.findMany({
    where: { opportunity_id: OID },
    select: { application_id: true, new_supervisor_name: true, previous_supervisor_name: true, action: true },
  });
  const auditByApp = new Map(audits.map((a) => [a.application_id, a]));
  console.log(JSON.stringify({
    missingSupervisors: missing,
    targets: missing.filter((m) => TARGETS.includes(m.num)),
    auditForMissing: missing.map((m) => ({ ...m, audit: auditByApp.get(m.applicationId) || null })),
  }, null, 2));
  await prisma.$disconnect();
})();
