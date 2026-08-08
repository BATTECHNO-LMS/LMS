/**
 * Dry-run / apply migration of INSTITUTION-scoped instructor assignments → trainer.
 * Usage:
 *   node scripts/migrate-institution-instructors-to-trainers.js
 *   node scripts/migrate-institution-instructors-to-trainers.js --apply
 */
'use strict';

const { prisma } = require('../src/config/db');

const APPLY = process.argv.includes('--apply');

async function main() {
  const trainerRole = await prisma.roles.findUnique({ where: { code: 'trainer' } });
  const instructorRole = await prisma.roles.findUnique({ where: { code: 'instructor' } });
  if (!trainerRole) {
    throw new Error('trainer role missing — run prisma migrate deploy first');
  }

  const rows = await prisma.user_organization_assignments.findMany({
    where: {
      role_code: 'instructor',
      organizations: { type: 'INSTITUTION' },
    },
    include: {
      organizations: { select: { id: true, name: true, code: true, type: true } },
      users: { select: { id: true, email: true, full_name: true } },
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
    const cohortLinks = await prisma.training_cohort_instructors.findMany({
      where: { instructor_id: row.user_id },
      include: {
        training_cohorts: {
          select: { id: true, name: true, program_id: true, organization_id: true },
        },
      },
    });

    const entry = {
      userId: row.user_id,
      email: row.users?.email,
      organization: row.organizations?.name,
      organizationCode: row.organizations?.code,
      assignmentId: row.id,
      isActive: row.is_active,
      hasUniversityAssignment: Boolean(uniAssign),
      cohortAssignments: cohortLinks.map((c) => ({
        cohortId: c.cohort_id,
        cohortName: c.training_cohorts?.name,
        programId: c.training_cohorts?.program_id,
      })),
      action: APPLY ? 'migrated' : 'would_migrate',
    };

    if (APPLY) {
      await prisma.user_organization_assignments.update({
        where: { id: row.id },
        data: { role_code: 'trainer', updated_at: new Date() },
      });

      const hasTrainerRole = await prisma.user_roles.findFirst({
        where: { user_id: row.user_id, role_id: trainerRole.id },
      });
      if (!hasTrainerRole) {
        await prisma.user_roles.create({
          data: { user_id: row.user_id, role_id: trainerRole.id },
        });
      }

      // Keep university instructor role if user still has university context.
      if (!uniAssign && instructorRole) {
        // Institution-only: replace instructor global role with trainer.
        await prisma.user_roles.deleteMany({
          where: { user_id: row.user_id, role_id: instructorRole.id },
        });
      }

      for (const link of cohortLinks) {
        if (link.training_cohorts?.organization_id !== row.organization_id) continue;
        const existing = await prisma.training_trainer_assignments.findFirst({
          where: {
            trainer_user_id: row.user_id,
            training_program_id: link.training_cohorts.program_id,
            training_cohort_id: link.cohort_id,
            is_active: true,
            revoked_at: null,
          },
        });
        if (!existing) {
          await prisma.training_trainer_assignments.create({
            data: {
              trainer_user_id: row.user_id,
              organization_id: row.organization_id,
              training_program_id: link.training_cohorts.program_id,
              training_cohort_id: link.cohort_id,
              is_lead_trainer: Boolean(link.is_primary),
              assigned_by: null,
            },
          });
        }
      }
    }

    report.push(entry);
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        count: report.length,
        report,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
