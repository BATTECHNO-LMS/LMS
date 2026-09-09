'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

const OUT_DIR = path.join(__dirname, '../tmp/mutah-word-qa-final');
const APP_IDS = [
  '216f81e3-b927-4977-8aef-85a42119ac17',
  '4c36f658-e7b8-45b7-affd-4fc80f68fa34',
];

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return { userId: rows[0].id, roles: ['super_admin'], isGlobal: true, universityId: null };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const out = await service.generateForApplications(user, APP_IDS, {
    regenerate: true,
    regenerationReason: 'MUTAH_V11_TWO_PAGE_COMMENT_BOX',
    finalize: true,
    mutahSoftDelivery: true,
  });
  for (const row of out.results) {
    const evaluationId =
      row.evaluationId ||
      (
        await prisma.field_training_final_evaluations.findFirst({
          where: { application_id: row.applicationId, is_current: true },
          select: { id: true },
        })
      )?.id;
    if (!evaluationId) continue;
    const downloaded = await service.downloadReport(user, evaluationId);
    fs.writeFileSync(path.join(OUT_DIR, downloaded.filename), downloaded.buffer);
  }
  console.log(JSON.stringify(out.results, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
