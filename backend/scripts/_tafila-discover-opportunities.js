'use strict';

require('dotenv').config();
const { prisma } = require('../src/config/db');

function looksLikeTafila(value) {
  const text = String(value || '');
  return text.includes('الطفيلة') || /tafilah|tafila|\bttu\b/i.test(text);
}

async function main() {
  const opportunities = await prisma.field_training_opportunities.findMany({
    include: {
      universities: { select: { name: true, name_en: true } },
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: { universities: { select: { name: true } } },
        take: 4,
      },
    },
    orderBy: { created_at: 'asc' },
  });
  const tafila = opportunities.filter(
    (row) =>
      looksLikeTafila(row.title) ||
      looksLikeTafila(row.universities?.name) ||
      looksLikeTafila(row.universities?.name_en) ||
      looksLikeTafila(row.field_training_opportunity_eligibility?.[0]?.universities?.name)
  );

  const rows = [];
  for (const opp of tafila) {
    const apps = await prisma.field_training_applications.groupBy({
      by: ['status', 'completion_eligibility_status'],
      where: { opportunity_id: opp.id },
      _count: true,
    });
    const approved = await prisma.field_training_applications.findMany({
      where: { opportunity_id: opp.id, status: 'approved' },
      select: {
        id: true,
        expelled_at: true,
        training_status: true,
        post_assessment_score: true,
        completed_training_hours: true,
        completion_eligibility_status: true,
        completion_letter_issued_at: true,
      },
    });
    const tasks = await prisma.field_training_tasks.count({
      where: { opportunity_id: opp.id },
    });
    const sessions = await prisma.field_training_sessions.count({
      where: { opportunity_id: opp.id },
    });
    rows.push({
      id: opp.id,
      title: opp.title,
      status: opp.status,
      university: opp.universities?.name || opp.field_training_opportunity_eligibility?.[0]?.universities?.name,
      required_hours: opp.required_training_hours,
      min_attendance: opp.minimum_attendance_percentage,
      requires_post: opp.requires_post_assessment,
      training_mode: opp.training_mode,
      location: opp.location,
      tasks,
      sessions,
      apps,
      approved: approved.length,
      approvedWithPost: approved.filter((a) => a.post_assessment_score != null).length,
      approvedEligible: approved.filter((a) => a.completion_eligibility_status === 'eligible').length,
      letters: approved.filter((a) => a.completion_letter_issued_at).length,
      expelled: approved.filter((a) => a.expelled_at || a.training_status === 'expelled').length,
    });
  }

  console.log(JSON.stringify({ count: tafila.length, opportunities: rows }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
