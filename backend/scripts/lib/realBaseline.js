const { prisma } = require('../../src/config/db');
const {
  REAL_BASELINE_MARKER,
  MUTAH_UNIVERSITY,
  MUTAH_EMAIL_DOMAIN,
  REQUIRED_ROLES,
  SPECIALTY_CATALOG,
} = require('./baselineCatalog');

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

async function ensureMutahUniversity() {
  const existing = await prisma.universities.findFirst({
    where: {
      OR: [{ name: MUTAH_UNIVERSITY.name }, { notes: { contains: REAL_BASELINE_MARKER } }],
    },
  });

  if (existing) {
    return prisma.universities.update({
      where: { id: existing.id },
      data: {
        ...MUTAH_UNIVERSITY,
        updated_at: new Date(),
      },
    });
  }

  return prisma.universities.create({
    data: MUTAH_UNIVERSITY,
  });
}

async function ensureMutahEmailDomain(universityId) {
  const existing = await prisma.university_email_domains.findFirst({
    where: { university_id: universityId, domain: MUTAH_EMAIL_DOMAIN },
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
      domain: MUTAH_EMAIL_DOMAIN,
      is_active: true,
    },
  });
}

async function ensureSpecialties() {
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
 * Idempotent real baseline: system roles, Mutah University, email domain, global specialties.
 * Does NOT create demo users — create Super Admin manually after setup.
 */
async function seedRealBaseline() {
  const roles = await ensureRoles();
  const university = await ensureMutahUniversity();
  await ensureMutahEmailDomain(university.id);
  const specialties = await ensureSpecialties();

  return {
    roles: roles.length,
    university: { id: university.id, name: university.name },
    domain: MUTAH_EMAIL_DOMAIN,
    specialties: specialties.size,
  };
}

module.exports = { seedRealBaseline, ensureRoles, ensureMutahUniversity, ensureMutahEmailDomain, ensureSpecialties };
