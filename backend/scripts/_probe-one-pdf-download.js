'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');

(async () => {
  const summary = require('../tmp/mutah-excel98-export/export-summary.json');
  const userRows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  const user = {
    userId: userRows[0].id,
    fullName: userRows[0].full_name,
    email: userRows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
  const first = summary.results[0];
  console.log('trying', first.evaluationId, first.universityNumber);
  const started = Date.now();
  const pdf = await service.downloadPdf(user, first.evaluationId);
  console.log(JSON.stringify({
    ms: Date.now() - started,
    bytes: pdf.buffer.length,
    filename: pdf.filename,
  }, null, 2));
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error('FAIL', err.code, err.message, err.details);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
