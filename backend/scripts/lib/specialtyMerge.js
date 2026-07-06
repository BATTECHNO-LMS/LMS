const { prisma } = require('../../src/config/db');

/**
 * Known duplicate groups — canonical record wins; aliases are merged then deactivated.
 */
const MERGE_RULES = [
  {
    name_ar: 'نظم المعلومات الإدارية',
    canonicalCode: 'MIS',
    aliasCodes: ['BIS'],
    canonicalNameEn: 'Management Information Systems',
  },
];

async function reassignSpecialtyReferences(fromId, toId) {
  const stats = { users: 0, fieldTraining: 0 };

  const userResult = await prisma.users.updateMany({
    where: { specialty_id: fromId },
    data: { specialty_id: toId, updated_at: new Date() },
  });
  stats.users = userResult.count;

  const ftResult = await prisma.field_training_opportunities.updateMany({
    where: { specialty_id: fromId },
    data: { specialty_id: toId, updated_at: new Date() },
  });
  stats.fieldTraining = ftResult.count;

  return stats;
}

async function deactivateSpecialty(id) {
  await prisma.specialties.update({
    where: { id },
    data: { status: 'inactive', updated_at: new Date() },
  });
}

/**
 * Merge duplicate specialties safely — reassign references, deactivate duplicates.
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function mergeDuplicateSpecialties(options = {}) {
  const log = options.log || (() => {});
  const summary = [];

  for (const rule of MERGE_RULES) {
    const candidates = await prisma.specialties.findMany({
      where: {
        OR: [
          { name_ar: rule.name_ar },
          { code: { in: [rule.canonicalCode, ...rule.aliasCodes] } },
        ],
      },
      orderBy: { created_at: 'asc' },
    });

    if (candidates.length <= 1) {
      if (candidates.length === 1) {
        const only = candidates[0];
        if (only.code !== rule.canonicalCode || only.status !== 'active') {
          await prisma.specialties.update({
            where: { id: only.id },
            data: {
              code: rule.canonicalCode,
              name_ar: rule.name_ar,
              name_en: rule.canonicalNameEn,
              status: 'active',
              updated_at: new Date(),
            },
          });
          log(`Normalized specialty: ${rule.name_ar} (${rule.canonicalCode})`);
        }
      }
      continue;
    }

    let canonical =
      candidates.find((r) => r.code === rule.canonicalCode) ||
      candidates.find((r) => r.status === 'active') ||
      candidates[0];

    canonical = await prisma.specialties.update({
      where: { id: canonical.id },
      data: {
        code: rule.canonicalCode,
        name_ar: rule.name_ar,
        name_en: rule.canonicalNameEn,
        status: 'active',
        updated_at: new Date(),
      },
    });

    const duplicates = candidates.filter((r) => r.id !== canonical.id);
    for (const dup of duplicates) {
      const moved = await reassignSpecialtyReferences(dup.id, canonical.id);
      await deactivateSpecialty(dup.id);
      log(
        `Merged specialty ${dup.code || dup.id} → ${rule.canonicalCode} ` +
          `(users: ${moved.users}, field training: ${moved.fieldTraining})`
      );
      summary.push({
        merged: dup.code || dup.id,
        canonical: rule.canonicalCode,
        ...moved,
      });
    }

    log(`Canonical specialty: ${rule.name_ar} / ${rule.canonicalNameEn} (${rule.canonicalCode})`);
  }

  // Generic pass: duplicate active name_ar (keep lowest code alphabetically or first created)
  const dupNames = await prisma.$queryRaw`
    SELECT name_ar, COUNT(*)::int AS cnt
    FROM specialties
    WHERE status = 'active'
    GROUP BY name_ar
    HAVING COUNT(*) > 1
  `;

  for (const row of dupNames) {
    const nameAr = row.name_ar;
    if (MERGE_RULES.some((r) => r.name_ar === nameAr)) continue;

    const rows = await prisma.specialties.findMany({
      where: { name_ar: nameAr, status: 'active' },
      orderBy: [{ code: 'asc' }, { created_at: 'asc' }],
    });
    const [canonical, ...duplicates] = rows;
    for (const dup of duplicates) {
      const moved = await reassignSpecialtyReferences(dup.id, canonical.id);
      await deactivateSpecialty(dup.id);
      log(`Merged duplicate name_ar "${nameAr}": ${dup.code || dup.id} → ${canonical.code || canonical.id}`);
      summary.push({ merged: dup.code, canonical: canonical.code, ...moved });
    }
  }

  return summary;
}

module.exports = { mergeDuplicateSpecialties, MERGE_RULES };
