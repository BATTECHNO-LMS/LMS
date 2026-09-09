'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const leftoverOldTemplate = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true, template_version: { not: 11 } },
    select: {
      id: true,
      application_id: true,
      student_id: true,
      template_version: true,
      eligibility_status: true,
    },
  });
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      completion_eligibility_status: true,
      completed_training_hours: true,
    },
  });
  const evals = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    select: { application_id: true, template_version: true, eligibility_status: true },
  });
  const evalByApp = new Map(evals.map((row) => [row.application_id, row]));
  const missingEval = apps.filter((app) => !evalByApp.has(app.id));
  const studentIds = [
    ...new Set([
      ...leftoverOldTemplate.map((row) => row.student_id),
      ...missingEval.map((row) => row.student_id),
      '1d3801c4-18ff-494e-8e3a-ce39e8ed03d7',
    ]),
  ];
  const users = await prisma.users.findMany({
    where: { id: { in: studentIds.filter((id) => id && id.includes('-')) } },
    select: { id: true, full_name: true, university_student_number: true },
  });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  const notEligibleLetters = await prisma.$queryRaw`
    SELECT l.id, l.application_id, l.letter_no, l.issued_at,
           a.completion_eligibility_status, a.completed_training_hours,
           u.full_name, u.university_student_number
    FROM field_training_completion_letters l
    JOIN field_training_applications a ON a.id = l.application_id
    JOIN users u ON u.id = a.student_id
    WHERE l.opportunity_id = ${OPPORTUNITY_ID}::uuid
      AND l.status = 'issued'
      AND a.completion_eligibility_status <> 'eligible'
  `;

  const failedApp = await prisma.field_training_applications.findUnique({
    where: { id: '1d3801c4-18ff-494e-8e3a-ce39e8ed03d7' },
    select: { id: true, student_id: true, completion_eligibility_status: true, completed_training_hours: true },
  });
  const failedUser = failedApp
    ? await prisma.users.findUnique({
        where: { id: failedApp.student_id },
        select: { full_name: true, university_student_number: true },
      })
    : null;

  console.log(
    JSON.stringify(
      {
        leftoverOldTemplate: leftoverOldTemplate.map((row) => ({
          ...row,
          student: userById[row.student_id] || null,
        })),
        missingEval: missingEval.map((row) => ({
          ...row,
          student: userById[row.student_id] || null,
        })),
        notEligibleLetters,
        failedLetterApp: failedApp ? { ...failedApp, student: failedUser } : null,
        approved: apps.length,
        currentEvals: evals.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
