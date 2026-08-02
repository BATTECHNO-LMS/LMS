/**
 * Idempotent seed for public institution portals.
 * Run: npm run seed:institutions
 */
'use strict';

const { prisma } = require('../src/config/db');
const { PUBLIC_INSTITUTION_SEEDS } = require('../src/modules/organizations/institutionSeedData');

async function resolveOrganization(seed) {
  const byCode = await prisma.organizations.findUnique({ where: { code: seed.code } });
  if (byCode) {
    const updated = await prisma.organizations.update({
      where: { id: byCode.id },
      data: {
        name: seed.name,
        name_en: seed.nameEn,
        short_name: seed.shortName,
        type: 'INSTITUTION',
        status: 'active',
        allows_public_trainee_registration: true,
        institution_kind: seed.institutionKind,
        country: 'Jordan',
        updated_at: new Date(),
      },
    });
    return { organization: updated, action: 'updated_by_code' };
  }

  const byName = await prisma.organizations.findFirst({
    where: {
      type: 'INSTITUTION',
      OR: [{ name: seed.name }, { name_en: seed.nameEn }, { short_name: seed.shortName }],
    },
  });

  if (byName) {
    const updated = await prisma.organizations.update({
      where: { id: byName.id },
      data: {
        code: seed.code,
        name: seed.name,
        name_en: seed.nameEn,
        short_name: seed.shortName,
        type: 'INSTITUTION',
        status: 'active',
        allows_public_trainee_registration: true,
        institution_kind: seed.institutionKind,
        country: 'Jordan',
        updated_at: new Date(),
      },
    });
    return {
      organization: updated,
      action: 'reconciled_by_name',
      previousCode: byName.code,
    };
  }

  const created = await prisma.organizations.create({
    data: {
      code: seed.code,
      name: seed.name,
      name_en: seed.nameEn,
      short_name: seed.shortName,
      type: 'INSTITUTION',
      status: 'active',
      allows_public_trainee_registration: true,
      institution_kind: seed.institutionKind,
      country: 'Jordan',
    },
  });
  return { organization: created, action: 'created' };
}

async function upsertBranches(organizationId, branches) {
  const results = [];
  for (let i = 0; i < branches.length; i += 1) {
    const branch = branches[i];
    const existing = await prisma.organization_branches.findFirst({
      where: {
        organization_id: organizationId,
        OR: [{ code: branch.code }, { name: branch.name }],
      },
    });

    if (existing) {
      const updated = await prisma.organization_branches.update({
        where: { id: existing.id },
        data: {
          code: branch.code,
          name: branch.name,
          city: branch.city || null,
          address: branch.address || null,
          sort_order: i + 1,
          is_active: true,
          updated_at: new Date(),
        },
      });
      results.push({
        code: branch.code,
        action: existing.code === branch.code ? 'updated' : 'reconciled',
        id: updated.id,
      });
    } else {
      const created = await prisma.organization_branches.create({
        data: {
          organization_id: organizationId,
          code: branch.code,
          name: branch.name,
          city: branch.city || null,
          address: branch.address || null,
          sort_order: i + 1,
          is_active: true,
        },
      });
      results.push({ code: branch.code, action: 'created', id: created.id });
    }
  }
  return results;
}

async function main() {
  const report = { organizations: [], branches: {} };

  for (const seed of PUBLIC_INSTITUTION_SEEDS) {
    const resolved = await resolveOrganization(seed);
    report.organizations.push({
      code: seed.code,
      id: resolved.organization.id,
      action: resolved.action,
      previousCode: resolved.previousCode || null,
    });
    report.branches[seed.code] = await upsertBranches(resolved.organization.id, seed.branches);
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        message: 'Institution seed complete',
        crownPrinceFoundationBranches: report.branches.CROWN_PRINCE_FOUNDATION.length,
        ministryOfYouthBranches: report.branches.MINISTRY_OF_YOUTH.length,
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
