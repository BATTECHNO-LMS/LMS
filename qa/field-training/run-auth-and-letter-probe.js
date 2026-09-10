'use strict';

const path = require('path');
const fs = require('fs');
const backendRoot = path.join(__dirname, '../../backend');
require(path.join(backendRoot, 'node_modules/dotenv')).config({
  path: path.join(backendRoot, '.env'),
});
process.chdir(backendRoot);
const { prisma } = require(path.join(backendRoot, 'src/config/db'));
const bcrypt = require(path.join(backendRoot, 'node_modules/bcrypt'));

async function main() {
  const out = { generatedAt: new Date().toISOString(), accounts: [] };
  const emails = [
    'superadmin@batuni.edu',
    'admin@batuni.edu',
    'reviewer@batuni.edu',
    process.env.QA_EMAIL,
  ].filter(Boolean);

  for (const email of emails) {
    const u = await prisma.users.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        status: true,
        password_hash: true,
        primary_university_id: true,
        preferred_organization_id: true,
      },
    });
    if (!u) {
      out.accounts.push({ email, exists: false });
      continue;
    }
    const pwdOk = u.password_hash
      ? await bcrypt.compare(process.env.QA_PASSWORD || '12345678', u.password_hash)
      : false;
    out.accounts.push({
      email,
      exists: true,
      status: u.status,
      pwdMatchesDefaultOrQa: pwdOk,
      hasUniversity: Boolean(u.primary_university_id),
    });
  }

  const letters = await prisma.$queryRawUnsafe(`
    SELECT l.id::text AS letter_id,
           a.id::text AS application_id,
           a.completion_eligibility_status::text AS eligibility,
           a.training_status::text AS training_status,
           u.university_student_number AS uni,
           a.opportunity_id::text AS opportunity_id,
           l.issued_at
    FROM field_training_completion_letters l
    JOIN field_training_applications a ON a.id = l.application_id
    JOIN users u ON u.id = a.student_id
    WHERE a.completion_eligibility_status::text IS DISTINCT FROM 'eligible'
       OR a.training_status::text = 'expelled'
       OR a.expelled_at IS NOT NULL
    LIMIT 20
  `);
  out.lettersForNonEligible = letters;

  const completedIneligible = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM field_training_applications
    WHERE training_status::text = 'completed'
      AND completion_eligibility_status::text = 'ineligible'
  `);
  out.completedButIneligibleCount = completedIneligible[0]?.c ?? 0;

  const dir = path.join(__dirname, '../../qa-artifacts/field-training/logs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'auth-and-letter-probe.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
