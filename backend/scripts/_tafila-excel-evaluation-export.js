'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingExcelEvaluation.service');

const OUT_DIR = path.join(__dirname, '../tmp/tafila-excel-evaluation');

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
  };
}

async function findTafilaOpportunity() {
  const opportunities = await prisma.field_training_opportunities.findMany({
    include: {
      universities: { select: { name: true, name_en: true, short_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  const match = opportunities.find(
    (row) =>
      looksLikeTafila(row.title) ||
      looksLikeTafila(row.universities?.name) ||
      looksLikeTafila(row.universities?.name_en)
  );
  if (!match) throw new Error('Tafila field training opportunity not found');
  return match;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const opportunity = await findTafilaOpportunity();
  const preview = await service.previewExcelEvaluation(user, opportunity.id);
  const file = await service.downloadExcelEvaluation(user, opportunity.id);
  const outPath = path.join(OUT_DIR, file.filename);
  fs.writeFileSync(outPath, file.buffer);
  const summary = {
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    universityName: preview.universityName,
    preview: preview.summary,
    download: file.summary,
    outPath,
    rowsMatch: preview.summary.totalStudents === file.summary.totalStudents,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
