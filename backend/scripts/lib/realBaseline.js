'use strict';

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
const { normalizeUniversityLabel } = require('../../src/utils/universityNameNormalize');

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

function collectNameAliases(spec) {
  const names = new Set();
  if (spec.name) names.add(String(spec.name).trim());
  for (const alias of spec.nameAliases || []) {
    const t = String(alias || '').trim();
    if (t) names.add(t);
  }
  return [...names];
}

function collectNameEnAliases(spec) {
  const names = new Set();
  if (spec.nameEn) names.add(String(spec.nameEn).trim());
  for (const alias of spec.nameEnAliases || []) {
    const t = String(alias || '').trim();
    if (t) names.add(t);
  }
  return [...names];
}

/**
 * Find an existing university by domain, code, Arabic name, or documented aliases.
 * Never creates a duplicate when an alias already exists.
 */
async function findExistingBaselineUniversity(spec) {
  const domain = spec.domain.trim().toLowerCase();
  let existing = await findUniversityByDomain(domain);
  if (existing) return existing;

  if (spec.code) {
    existing = await prisma.universities.findFirst({ where: { code: spec.code } });
    if (existing) return existing;
  }

  const arabicNames = collectNameAliases(spec);
  if (arabicNames.length) {
    existing = await prisma.universities.findFirst({
      where: { name: { in: arabicNames } },
    });
    if (existing) return existing;
  }

  const englishNames = collectNameEnAliases(spec);
  for (const nameEn of englishNames) {
    existing = await prisma.universities.findFirst({
      where: { name_en: { equals: nameEn, mode: 'insensitive' } },
    });
    if (existing) return existing;
  }

  return null;
}

/**
 * Ensure a type=UNIVERSITY organization row and 1:1 universities.organization_id bridge.
 * Preserves existing organization IDs; does not reassign unrelated orgs.
 */
async function ensureUniversityOrganization(university, spec) {
  const notes = buildUniversityNotes(spec);
  const preferredCode = spec.code ? String(spec.code).trim() : null;
  const orgPayload = {
    type: 'UNIVERSITY',
    name: spec.name,
    name_en: spec.nameEn || null,
    short_name: spec.shortName || null,
    website: spec.website || null,
    country: spec.country || null,
    city: spec.city || null,
    contact_email: spec.contact_email || null,
    status: 'active',
    notes,
    updated_at: new Date(),
  };

  let organization = null;

  if (university.organization_id) {
    organization = await prisma.organizations.findUnique({
      where: { id: university.organization_id },
    });
  }

  if (!organization && preferredCode) {
    organization = await prisma.organizations.findFirst({
      where: { type: 'UNIVERSITY', code: preferredCode },
    });
  }

  if (!organization) {
    const arabicNames = collectNameAliases(spec);
    organization = await prisma.organizations.findFirst({
      where: { type: 'UNIVERSITY', name: { in: arabicNames } },
    });
  }

  if (organization) {
    const updateData = { ...orgPayload };
    // Keep legacy UNI-* codes unless the org has no code and we have a preferred one.
    if (!organization.code && preferredCode) {
      updateData.code = preferredCode;
    } else if (
      preferredCode &&
      organization.code &&
      normalizeUniversityLabel(organization.code) === normalizeUniversityLabel(preferredCode)
    ) {
      updateData.code = preferredCode;
    }
    organization = await prisma.organizations.update({
      where: { id: organization.id },
      data: updateData,
    });
  } else {
    organization = await prisma.organizations.create({
      data: {
        ...orgPayload,
        code: preferredCode || `UNI-${String(university.id).replace(/-/g, '').slice(0, 12)}`,
        created_at: new Date(),
      },
    });
  }

  if (university.organization_id !== organization.id) {
    await prisma.universities.update({
      where: { id: university.id },
      data: { organization_id: organization.id, updated_at: new Date() },
    });
  }

  return organization;
}

/**
 * Idempotent upsert for one real baseline university + active email domain + UNIVERSITY org bridge.
 * Matches by email domain, code, Arabic name, then aliases — never creates duplicates.
 */
async function ensureBaselineUniversity(spec) {
  const domain = spec.domain.trim().toLowerCase();
  const existing = await findExistingBaselineUniversity(spec);

  const data = {
    name: spec.name,
    name_en: spec.nameEn || null,
    short_name: spec.shortName || null,
    type: 'University',
    website: spec.website || null,
    country: spec.country || null,
    city: spec.city || null,
    contact_person: 'إدارة المنصة',
    contact_email: spec.contact_email,
    contact_phone: null,
    status: 'active',
    partnership_state: 'active',
    notes: buildUniversityNotes(spec),
  };

  // Set code when creating, or when the existing row has no code yet.
  if (spec.code && (!existing || !existing.code)) {
    data.code = spec.code;
  }

  const university = existing
    ? await prisma.universities.update({
        where: { id: existing.id },
        data: { ...data, updated_at: new Date() },
      })
    : await prisma.universities.create({
        data: {
          ...data,
          code: spec.code || null,
        },
      });

  await ensureEmailDomain(university.id, domain);
  const organization = await ensureUniversityOrganization(university, spec);

  return { university, domain, organization };
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
    universities: universities.map(({ university, domain, organization }) => ({
      id: university.id,
      name: university.name,
      nameEn: university.name_en,
      code: university.code,
      domain,
      organizationId: organization?.id || university.organization_id || null,
      organizationType: organization?.type || 'UNIVERSITY',
      status: university.status,
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
  ensureUniversityOrganization,
  findExistingBaselineUniversity,
  ensureSpecialties,
  ensureUniversitySpecialties,
  deactivateExcludedUniversitySpecialties,
};
