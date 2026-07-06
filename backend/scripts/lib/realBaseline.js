const { prisma } = require('../../src/config/db');
const {
  REAL_UNIVERSITIES,
  REQUIRED_ROLES,
  SPECIALTY_CATALOG,
  buildUniversityNotes,
} = require('./baselineCatalog');
const { mergeDuplicateSpecialties } = require('./specialtyMerge');

async function ensureRoles() {
  const rows = [];
  for (const role of REQUIRED_ROLES) {
    const row = await prisma.roles.upsert({
      where: { code: role.code },
      update: { name: role.name, scope: role.scope, description: role.name },
      create: {
        name: role.name,
        code: role.code,
        scope: role.scope,
        description: role.name,
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

/**
 * Idempotent real baseline: system roles, Jordanian universities + domains, global specialties.
 * Does NOT create users or delete any data.
 */
async function seedRealBaseline() {
  const roles = await ensureRoles();
  const universities = await ensureBaselineUniversities();
  const specialties = await ensureSpecialties();

  return {
    roles: roles.length,
    universities: universities.map(({ university, domain }) => ({
      id: university.id,
      name: university.name,
      domain,
    })),
    specialties: specialties.size,
  };
}

module.exports = {
  seedRealBaseline,
  ensureRoles,
  ensureBaselineUniversity,
  ensureBaselineUniversities,
  ensureEmailDomain,
  ensureSpecialties,
};
