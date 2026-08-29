'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { prisma } = require('../src/config/db');
const letter = require('../src/modules/fieldTraining/fieldTraining.completionLetter');
const hoursMod = require('../src/modules/fieldTraining/fieldTraining.hours');
const {
  resolveOfficialUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.universityNumber');

const outDir = path.join(__dirname, '../tmp/completion-letter-verify');
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const rows = await prisma.field_training_applications.findMany({
    where: {
      completion_eligibility_status: 'eligible',
      status: 'approved',
      training_status: { not: 'expelled' },
      completed_training_hours: { gte: 140 },
    },
    take: 8,
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      student_id: true,
      opportunity_id: true,
      completed_training_hours: true,
      completion_eligibility_status: true,
      updated_at: true,
      field_training_opportunities: {
        select: { id: true, title: true, start_date: true, end_date: true },
      },
    },
  });

  const profiles = await prisma.users.findMany({
    where: { id: { in: rows.map((r) => r.student_id) } },
    select: {
      id: true,
      full_name: true,
      email: true,
      email_verified_at: true,
      university_student_number: true,
      primary_university_id: true,
    },
  });
  const uniIds = [...new Set(profiles.map((p) => p.primary_university_id).filter(Boolean))];
  const unis = uniIds.length
    ? await prisma.universities.findMany({
        where: { id: { in: uniIds } },
        select: { id: true, name: true },
      })
    : [];
  const uniById = Object.fromEntries(unis.map((u) => [u.id, u]));
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const usable = [];
  for (const app of rows) {
    const student = profileById[app.student_id];
    if (!student) continue;
    const number = resolveOfficialUniversityNumber(student).number;
    if (!number) continue;
    usable.push({ app, student, number });
    if (usable.length === 2) break;
  }

  if (usable.length < 2) {
    console.log(JSON.stringify({ error: 'NEED_TWO_ELIGIBLE_STUDENTS', found: usable.length, scanned: rows.length }));
    return;
  }

  const results = [];
  for (const item of usable) {
    const opp = item.app.field_training_opportunities;
    const payload = letter.buildLetterPayload({
      app: item.app,
      opportunity: opp,
      student: {
        ...item.student,
        university: uniById[item.student.primary_university_id] || { name: '—' },
        specialty: { name_ar: '—' },
      },
      hoursProgress: { completed_training_hours: hoursMod.toNullableInt(item.app.completed_training_hours) },
      letter: { letter_no: `FT-LIVE-${item.app.id.slice(0, 6).toUpperCase()}`, issued_at: new Date() },
    });
    const pdf = await letter.renderCompletionLetterPdf(payload);
    const filename = letter.buildDownloadFilename(payload.studentName, payload.universityNumber);
    const filePath = path.join(outDir, `live-${filename}`);
    fs.writeFileSync(filePath, pdf);
    results.push({
      applicationId: item.app.id,
      studentName: payload.studentName,
      universityNumber: payload.universityNumber,
      universityName: payload.universityName,
      hours: payload.completedHours,
      opportunityTitle: payload.opportunityTitle,
      filename,
      bytes: pdf.length,
      fontEmbedded: /Sakkal|Majalla/i.test(pdf.toString('latin1')),
    });
  }

  const leak =
    results[0].studentName !== results[1].studentName &&
    results[0].universityNumber !== results[1].universityNumber;
  console.log(JSON.stringify({ ok: leak, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
