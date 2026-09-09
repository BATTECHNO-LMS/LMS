'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');

const TAFILA_ID = '01666ebc-bfc1-4948-87a5-2add3f641c65';

function looksLikeTafila(value) {
  const text = String(value || '');
  return text.includes('الطفيلة') || /tafilah|tafila|ttu/i.test(text);
}

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
    organizationType: 'UNIVERSITY',
  };
}

async function findTafilaOpportunity() {
  const existing = await prisma.field_training_opportunities.findUnique({
    where: { id: TAFILA_ID },
    include: { universities: { select: { name: true } } },
  });
  if (existing) return existing;
  const opportunities = await prisma.field_training_opportunities.findMany({
    include: { universities: { select: { name: true } } },
    orderBy: { created_at: 'desc' },
  });
  const match = opportunities.find(
    (row) => looksLikeTafila(row.title) || looksLikeTafila(row.universities?.name)
  );
  if (!match) throw new Error('Tafila field training opportunity not found');
  return match;
}

async function main() {
  const user = await findSuperAdminUser();
  const opportunity = await findTafilaOpportunity();
  const list = await letterService.listCompletionLetters(opportunity.id, user, { page_size: 100 });
  const preview = await letterService.previewBulkIssue(opportunity.id, user);
  const summary = {
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    counters: list.counters,
    preview: {
      total: preview.total_students,
      eligible: preview.eligible_students,
      alreadyIssued: preview.letters_already_issued,
      toIssue: preview.letters_to_issue,
      skipped: preview.skipped?.length || 0,
    },
    skipReasons: Object.fromEntries(
      Object.entries(
        (preview.skipped || []).reduce((acc, row) => {
          const key = row.reason_label || row.reason || 'unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      )
    ),
    students: (list.students || []).map((row) => ({
      name: row.student_name,
      number: row.university_number,
      status: row.completion_eligibility_status,
      hours: row.completed_training_hours,
      appStatus: row.status,
      issuance: row.issuance_status,
      skip: row.skip_reason_label,
      willIssue: row.will_issue,
      alreadyIssued: row.already_issued,
      letterNo: row.letter_no,
    })),
  };

  if (!preview.letters_to_issue) {
    summary.issued = false;
    summary.reason = 'NO_ELIGIBLE_STUDENTS';
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const job = await letterService.startBulkIssue(opportunity.id, user, { sync: true });
  summary.issued = true;
  summary.job = {
    id: job.id,
    status: job.status,
    progress: job.progress,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    console.error(JSON.stringify(err.details || err.data || null, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
