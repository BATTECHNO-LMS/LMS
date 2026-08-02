/**
 * Dev helper: active institution instructor + trainee for portal testing.
 * Run: node scripts/seed-institution-demo-users.js
 */
'use strict';

const { prisma } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const PASSWORD = '12345678';

const ACCOUNTS = [
  {
    email: 'trainer.cpf@demo.local',
    full_name: 'مدرب مؤسسة ولي العهد',
    role: 'trainer',
  },
  {
    email: 'trainee.cpf@demo.local',
    full_name: 'متدرب مؤسسة ولي العهد',
    role: 'trainee',
  },
];

async function main() {
  const org = await prisma.organizations.findUnique({
    where: { code: 'CROWN_PRINCE_FOUNDATION' },
  });
  if (!org) {
    throw new Error('Run npm run seed:institutions first (CROWN_PRINCE_FOUNDATION missing).');
  }

  const branch = await prisma.organization_branches.findFirst({
    where: { organization_id: org.id, code: 'CPF_AMMAN', is_active: true },
  });
  if (!branch) {
    throw new Error('CPF_AMMAN branch missing. Re-run seed:institutions.');
  }

  const passwordHash = await hashPassword(PASSWORD);
  const now = new Date();
  const created = [];

  for (const account of ACCOUNTS) {
    const role = await prisma.roles.findUnique({ where: { code: account.role } });
    if (!role) throw new Error(`Missing role ${account.role}`);

    const user = await prisma.users.upsert({
      where: { email: account.email },
      update: {
        full_name: account.full_name,
        password_hash: passwordHash,
        status: 'active',
        email_verified_at: now,
        activated_at: now,
        phone: '0790000000',
        updated_at: now,
      },
      create: {
        full_name: account.full_name,
        email: account.email,
        password_hash: passwordHash,
        status: 'active',
        email_verified_at: now,
        activated_at: now,
        phone: '0790000000',
      },
    });

    await prisma.user_roles.deleteMany({
      where: { user_id: user.id, role_id: { not: role.id } },
    });
    const roleLink = await prisma.user_roles.findFirst({
      where: { user_id: user.id, role_id: role.id },
    });
    if (!roleLink) {
      await prisma.user_roles.create({
        data: { user_id: user.id, role_id: role.id },
      });
    }

    const assignment = await prisma.user_organization_assignments.findFirst({
      where: { user_id: user.id, organization_id: org.id },
    });
    if (assignment) {
      await prisma.user_organization_assignments.update({
        where: { id: assignment.id },
        data: {
          role_code: account.role,
          branch_id: branch.id,
          is_active: true,
          updated_at: now,
        },
      });
    } else {
      await prisma.user_organization_assignments.create({
        data: {
          user_id: user.id,
          organization_id: org.id,
          role_code: account.role,
          branch_id: branch.id,
          is_active: true,
        },
      });
    }

    await prisma.users.update({
      where: { id: user.id },
      data: { preferred_organization_id: org.id, updated_at: now },
    });

    created.push({
      role: account.role === 'trainee' ? 'متدرب' : account.role === 'trainer' ? 'مدرب' : account.role,
      email: account.email,
      password: PASSWORD,
      organization: org.name,
      branch: branch.name,
      login: '/institutions/login',
    });
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, accounts: created }, null, 2));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
