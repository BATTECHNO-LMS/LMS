/**
 * Dry-run / apply migration of INSTITUTION-scoped student assignments → trainee.
 * Usage:
 *   node scripts/migrate-institution-students-to-trainees.js
 *   node scripts/migrate-institution-students-to-trainees.js --apply
 */
'use strict';

const { prisma } = require('../src/config/db');

const APPLY = process.argv.includes('--apply');

async function main() {
  const traineeRole = await prisma.roles.findUnique({ where: { code: 'trainee' } });
  const studentRole = await prisma.roles.findUnique({ where: { code: 'student' } });
  if (!traineeRole) {
    throw new Error('trainee role missing — run prisma migrate deploy first');
  }

  const rows = await prisma.user_organization_assignments.findMany({
    where: {
      role_code: 'student',
      organizations: { type: 'INSTITUTION' },
    },
    include: {
      organizations: { select: { id: true, name: true, code: true, type: true } },
      users: { select: { id: true, email: true, full_name: true, status: true } },
    },
  });

  const report = [];
  for (const row of rows) {
    const uniAssign = await prisma.user_organization_assignments.findFirst({
      where: {
        user_id: row.user_id,
        is_active: true,
        organizations: { type: 'UNIVERSITY' },
      },
    });
    const uniStudentRole = studentRole
      ? await prisma.user_roles.findFirst({
          where: { user_id: row.user_id, role_id: studentRole.id },
        })
      : null;

    const entry = {
      userId: row.user_id,
      email: row.users?.email,
      fullName: row.users?.full_name,
      status: row.users?.status,
      organization: row.organizations?.name,
      organizationCode: row.organizations?.code,
      assignmentId: row.id,
      isActive: row.is_active,
      hasUniversityAssignment: Boolean(uniAssign),
      keepUniversityStudentRole: Boolean(uniAssign || uniStudentRole),
      action: APPLY ? 'migrated' : 'would_migrate',
    };

    if (APPLY) {
      await prisma.user_organization_assignments.update({
        where: { id: row.id },
        data: { role_code: 'trainee', updated_at: new Date() },
      });

      const hasTraineeRole = await prisma.user_roles.findFirst({
        where: { user_id: row.user_id, role_id: traineeRole.id },
      });
      if (!hasTraineeRole) {
        await prisma.user_roles.create({
          data: { user_id: row.user_id, role_id: traineeRole.id },
        });
      }

      // Institution-only: remove global student role. Dual-context keeps student.
      if (!uniAssign && studentRole) {
        await prisma.user_roles.deleteMany({
          where: { user_id: row.user_id, role_id: studentRole.id },
        });
      }
    }

    report.push(entry);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', count: report.length, report }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
