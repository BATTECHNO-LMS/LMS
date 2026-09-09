'use strict';

require('dotenv').config();
const { prisma } = require('../src/config/db');

const OPP = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function main() {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: OPP, status: 'approved' },
    orderBy: { created_at: 'asc' },
    take: 10,
    select: {
      id: true,
      completion_eligibility_status: true,
      created_at: true,
      student_id: true,
    },
  });
  const users = await prisma.users.findMany({
    where: { id: { in: apps.map((a) => a.student_id) } },
    select: {
      id: true,
      full_name: true,
      university_student_number: true,
      email: true,
      primary_university_id: true,
    },
  });
  const evals = await prisma.field_training_final_evaluations.findMany({
    where: {
      opportunity_id: OPP,
      is_current: true,
      application_id: { in: apps.map((a) => a.id) },
    },
    select: {
      application_id: true,
      template_id: true,
      template_version: true,
      eligibility_status: true,
      filled_docx_file_id: true,
      score_evidence_json: true,
    },
  });
  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status'],
    where: { opportunity_id: OPP, is_current: true },
    _count: { _all: true },
  });
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OPP },
    select: { evaluation_template_id: true, host_organization: true, title: true },
  });
  console.log(
    JSON.stringify(
      {
        opp,
        versions,
        apps,
        users,
        evals: evals.map((row) => ({
          application_id: row.application_id,
          template_id: row.template_id,
          template_version: row.template_version,
          eligibility_status: row.eligibility_status,
          hasFile: Boolean(row.filled_docx_file_id),
          training_days: row.score_evidence_json?.templatePayload?.training_days,
        })),
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
