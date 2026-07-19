const { prisma } = require('../../src/config/db');
const {
  REAL_UNIVERSITIES,
  REQUIRED_ROLES,
  SPECIALTY_CATALOG,
  UNIVERSITY_SPECIALTY_CATALOG,
  DEACTIVATE_UNIVERSITY_SPECIALTY_RULES,
  buildUniversityNotes,
} = require('./baselineCatalog');
const { mergeDuplicateSpecialties } = require('./specialtyMerge');

async function ensureRoles() {
  const rows = [];
  for (const role of REQUIRED_ROLES) {
    const row = await prisma.roles.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        scope: role.scope,
        description: role.description || role.name,
      },
      create: {
        name: role.name,
        code: role.code,
        scope: role.scope,
        description: role.description || role.name,
      },
    });
    rows.push(row);
  }
  return rows;
}

async function findUniversityByDomain(domain) {
  const normalized = String(domain).trim().toLowerCase();
  const domainRow = await prisma.university_email_domains.findFirst({
    where: { domain: normalized },
    select: { university_id: true },
  });
  if (!domainRow) return null;
  return prisma.universities.findUnique({ where: { id: domainRow.university_id } });
}

async function ensureEmailDomain(universityId, domain) {
  const normalized = String(domain).trim().toLowerCase();
  const existing = await prisma.university_email_domains.findFirst({
    where: { university_id: universityId, domain: normalized },
  });
  if (existing) {
    return prisma.university_email_domains.update({
      where: { id: existing.id },
      data: { is_active: true, updated_at: new Date() },
    });
  }
  return prisma.university_email_domains.create({
    data: {
      university_id: universityId,
      domain: normalized,
      is_active: true,
    },
  });
}

/**
 * Idempotent upsert for one real baseline university + active email domain.
 * Matches by email domain first, then by Arabic name — never creates duplicates.
 */
async function ensureBaselineUniversity(spec) {
  const domain = spec.domain.trim().toLowerCase();
  let existing = await findUniversityByDomain(domain);
  if (!existing) {
    existing = await prisma.universities.findFirst({ where: { name: spec.name } });
  }

  const data = {
    name: spec.name,
    type: 'University',
    contact_person: 'إدارة المنصة',
    contact_email: spec.contact_email,
    contact_phone: null,
    status: 'active',
    partnership_state: 'active',
    notes: buildUniversityNotes(spec),
  };

  const university = existing
    ? await prisma.universities.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date() },
      })
    : await prisma.universities.create({ data });

  await ensureEmailDomain(university.id, domain);
  return { university, domain };
}

async function ensureBaselineUniversities() {
  const results = [];
  for (const spec of REAL_UNIVERSITIES) {
    const row = await ensureBaselineUniversity(spec);
    results.push(row);
  }
  return results;
}

async function ensureSpecialties() {
  await mergeDuplicateSpecialties();

  const byCode = new Map();
  for (const spec of SPECIALTY_CATALOG) {
    const existing = await prisma.specialties.findFirst({ where: { code: spec.code } });
    const row = existing
      ? await prisma.specialties.update({
          where: { id: existing.id },
          data: {
            name_ar: spec.name_ar,
            name_en: spec.name_en,
            status: 'active',
            updated_at: new Date(),
          },
        })
      : await prisma.specialties.create({
          data: {
            name_ar: spec.name_ar,
            name_en: spec.name_en,
            code: spec.code,
            status: 'active',
          },
        });
    byCode.set(spec.code, row);
  }
  return byCode;
}

async function ensureUniversitySpecialties(specialtyByCode) {
  let count = 0;
  for (const spec of UNIVERSITY_SPECIALTY_CATALOG) {
    const university = await findUniversityByDomain(spec.universityDomain);
    if (!university) continue;

    for (const program of spec.programs) {
      const canonical = program.canonicalCode
        ? specialtyByCode.get(program.canonicalCode)
        : null;
      const existing = await prisma.university_specialties.findFirst({
        where: {
          university_id: university.id,
          code: program.code,
        },
      });

      const data = {
        university_id: university.id,
        specialty_id: canonical?.id ?? null,
        name_ar: program.name_ar,
        name_en: program.name_en,
        code: program.code,
        college_name_ar: spec.collegeNameAr,
        college_name_en: spec.collegeNameEn,
        status: 'active',
        updated_at: new Date(),
      };

      if (existing) {
        await prisma.university_specialties.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.university_specialties.create({ data });
      }
      count += 1;
    }
  }
  return count;
}

async function deactivateExcludedUniversitySpecialties() {
  let count = 0;
  for (const rule of DEACTIVATE_UNIVERSITY_SPECIALTY_RULES) {
    const university = await findUniversityByDomain(rule.universityDomain);
    if (!university) continue;

    const orFilters = [];
    if (rule.codes?.length) {
      orFilters.push({ code: { in: rule.codes } });
    }
    if (rule.nameArIncludes?.length) {
      for (const fragment of rule.nameArIncludes) {
        orFilters.push({ name_ar: { contains: fragment } });
      }
    }
    if (!orFilters.length) continue;

    const rows = await prisma.university_specialties.findMany({
      where: {
        university_id: university.id,
        status: 'active',
        OR: orFilters,
      },
      select: { id: true },
    });

    for (const row of rows) {
      await prisma.university_specialties.update({
        where: { id: row.id },
        data: { status: 'inactive', updated_at: new Date() },
      });
      count += 1;
    }
  }
  return count;
}

/**
 * Idempotent real baseline: system roles, Jordanian universities + domains, global specialties.
 * Does NOT create users or delete any data.
 */
async function seedRealBaseline() {
  const roles = await ensureRoles();
  const universities = await ensureBaselineUniversities();
  const specialties = await ensureSpecialties();
  const universitySpecialties = await ensureUniversitySpecialties(specialties);
  const deactivatedUniversitySpecialties = await deactivateExcludedUniversitySpecialties();

  return {
    roles: roles.length,
    universities: universities.map(({ university, domain }) => ({
      id: university.id,
      name: university.name,
      domain,
    })),
    specialties: specialties.size,
    universitySpecialties,
    deactivatedUniversitySpecialties,
  };
}

module.exports = {
  seedRealBaseline,
  ensureRoles,
  ensureBaselineUniversity,
  ensureBaselineUniversities,
  ensureEmailDomain,
  ensureSpecialties,
  ensureUniversitySpecialties,
  deactivateExcludedUniversitySpecialties,
};
