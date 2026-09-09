'use strict';

require('dotenv').config();
const { prisma } = require('../src/config/db');

const IDS = [
  '4d9466cb-127b-42f2-ac08-88e7fcc7c7df',
  '01666ebc-bfc1-4948-87a5-2add3f641c65',
];

async function main() {
  const out = [];
  for (const id of IDS) {
    const opp = await prisma.field_training_opportunities.findUnique({
      where: { id },
      select: { title: true, training_mode: true },
    });
    const approved = await prisma.field_training_applications.findMany({
      where: { opportunity_id: id, status: 'approved' },
      select: {
        id: true,
        completion_eligibility_status: true,
        completed_training_hours: true,
        completion_letter_issued_at: true,
        expelled_at: true,
        training_status: true,
        post_assessment_score: true,
      },
    });
    const letters = await prisma.field_training_completion_letters.count({
      where: {
        application_id: { in: approved.map((row) => row.id) },
        status: 'issued',
      },
    });
    const eligible = approved.filter(
      (row) => row.completion_eligibility_status === 'eligible' && !row.expelled_at && row.training_status !== 'expelled'
    );
    out.push({
      id,
      title: opp.title,
      mode: opp.training_mode,
      approved: approved.length,
      eligible: eligible.length,
      eligibleWith140: eligible.filter((row) => Number(row.completed_training_hours || 0) >= 140).length,
      lettersIssuedAt: approved.filter((row) => row.completion_letter_issued_at).length,
      letterRows: letters,
      expelled: approved.filter((row) => row.expelled_at || row.training_status === 'expelled').length,
      ineligible: approved.filter((row) => row.completion_eligibility_status !== 'eligible').length,
    });
  }
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
