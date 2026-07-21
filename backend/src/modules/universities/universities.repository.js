const { prisma } = require('../../config/db');

const universitySelect = {
  id: true,
  name: true,
  name_en: true,
  short_name: true,
  code: true,
  type: true,
  website: true,
  country: true,
  city: true,
  address: true,
  contact_person: true,
  contact_email: true,
  contact_phone: true,
  logo_url: true,
  status: true,
  partnership_state: true,
  notes: true,
  created_at: true,
  updated_at: true,
};

const emailDomainSelect = {
  id: true,
  university_id: true,
  domain: true,
  is_active: true,
  is_primary: true,
  created_at: true,
  updated_at: true,
};

const specialtySelect = {
  id: true,
  university_id: true,
  specialty_id: true,
  name_ar: true,
  name_en: true,
  code: true,
  college_name_ar: true,
  college_name_en: true,
  status: true,
  created_at: true,
  updated_at: true,
  specialties: {
    select: { id: true, name_ar: true, name_en: true, code: true },
  },
};

const detailInclude = {
  university_email_domains: {
    select: emailDomainSelect,
    orderBy: [{ is_primary: 'desc' }, { domain: 'asc' }],
  },
  university_specialties: {
    select: specialtySelect,
    orderBy: [{ status: 'asc' }, { name_ar: 'asc' }],
  },
};

function mapSpecialtyRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    university_id: row.university_id,
    specialty_id: row.specialty_id,
    name_ar: row.name_ar,
    name_en: row.name_en,
    code: row.code,
    college_name_ar: row.college_name_ar,
    college_name_en: row.college_name_en,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    canonical_specialty: row.specialties
      ? {
          id: row.specialties.id,
          name_ar: row.specialties.name_ar,
          name_en: row.specialties.name_en,
          code: row.specialties.code,
        }
      : null,
  };
}

function mapUniversityRow(row, { includeRelations = false } = {}) {
  if (!row) return null;
  const base = {
    id: row.id,
    name: row.name,
    name_en: row.name_en ?? null,
    short_name: row.short_name ?? null,
    code: row.code ?? null,
    type: row.type ?? null,
    website: row.website ?? null,
    country: row.country ?? null,
    city: row.city ?? null,
    address: row.address ?? null,
    contact_person: row.contact_person ?? null,
    contact_email: row.contact_email ?? null,
    contact_phone: row.contact_phone ?? null,
    logo_url: row.logo_url ?? null,
    status: row.status,
    partnership_state: row.partnership_state,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  if (!includeRelations) return base;

  return {
    ...base,
    email_domains: (row.university_email_domains || []).map((d) => ({
      id: d.id,
      university_id: d.university_id,
      domain: d.domain,
      is_active: Boolean(d.is_active),
      is_primary: Boolean(d.is_primary),
      created_at: d.created_at,
      updated_at: d.updated_at,
    })),
    specialties: (row.university_specialties || []).map(mapSpecialtyRow),
  };
}

async function findAllOrdered() {
  const rows = await prisma.universities.findMany({
    select: {
      ...universitySelect,
      _count: {
        select: {
          university_specialties: { where: { status: 'active' } },
          university_email_domains: { where: { is_active: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map((row) => ({
    ...mapUniversityRow(row),
    active_specialties_count: row._count?.university_specialties ?? 0,
    active_email_domains_count: row._count?.university_email_domains ?? 0,
  }));
}

async function findById(id, { includeRelations = true } = {}) {
  const row = await prisma.universities.findFirst({
    where: { id },
    select: includeRelations ? { ...universitySelect, ...detailInclude } : universitySelect,
  });
  return mapUniversityRow(row, { includeRelations });
}

async function findByName(name) {
  return prisma.universities.findFirst({
    where: { name },
    select: { id: true },
  });
}

async function findByCode(code) {
  if (!code) return null;
  return prisma.universities.findFirst({
    where: { code },
    select: { id: true },
  });
}

async function findActiveDomainElsewhere(domain, excludeUniversityId = null) {
  return prisma.university_email_domains.findFirst({
    where: {
      domain,
      is_active: true,
      ...(excludeUniversityId ? { university_id: { not: excludeUniversityId } } : {}),
    },
    select: {
      id: true,
      university_id: true,
      domain: true,
      universities: { select: { id: true, name: true } },
    },
  });
}

async function countLinkedUsers(universityId) {
  return prisma.university_users.count({
    where: { university_id: universityId },
  });
}

async function countLinkedMicroCredentials(universityId) {
  return prisma.micro_credential_universities.count({
    where: { university_id: universityId },
  });
}

async function countUsersOnSpecialty(specialtyId) {
  return prisma.users.count({
    where: { university_specialty_id: specialtyId },
  });
}

/**
 * Create university + nested domains/specialties in one transaction.
 */
async function createUniversityWithRelations(universityData, { emailDomains = [], specialties = [] } = {}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.universities.create({
      data: universityData,
      select: universitySelect,
    });

    if (emailDomains.length) {
      await tx.university_email_domains.createMany({
        data: emailDomains.map((d) => ({
          university_id: created.id,
          domain: d.domain,
          is_active: d.is_active !== false,
          is_primary: Boolean(d.is_primary),
        })),
      });
    }

    for (const s of specialties) {
      await tx.university_specialties.create({
        data: {
          university_id: created.id,
          name_ar: s.name_ar,
          name_en: s.name_en ?? null,
          code: s.code,
          college_name_ar: s.college_name_ar ?? null,
          college_name_en: s.college_name_en ?? null,
          specialty_id: s.specialty_id ?? null,
          status: s.status ?? 'active',
        },
      });
    }

    const full = await tx.universities.findFirst({
      where: { id: created.id },
      select: { ...universitySelect, ...detailInclude },
    });
    return mapUniversityRow(full, { includeRelations: true });
  });
}

/**
 * Update university core fields and sync nested domains/specialties.
 * Domains/specialties omitted from payload are left untouched.
 * When arrays are provided: upsert listed rows; deactivate rows missing from the list.
 */
async function updateUniversityWithRelations(
  id,
  universityData,
  { emailDomains, specialties } = {}
) {
  return prisma.$transaction(async (tx) => {
    if (universityData && Object.keys(universityData).length) {
      await tx.universities.update({
        where: { id },
        data: universityData,
      });
    }

    if (emailDomains !== undefined) {
      const existing = await tx.university_email_domains.findMany({
        where: { university_id: id },
        select: emailDomainSelect,
      });
      const existingById = new Map(existing.map((d) => [d.id, d]));
      const existingByDomain = new Map(existing.map((d) => [d.domain, d]));
      const keepIds = new Set();

      for (const item of emailDomains) {
        const byId = item.id ? existingById.get(item.id) : null;
        const byDomain = existingByDomain.get(item.domain);
        const target = byId || byDomain || null;

        if (target) {
          keepIds.add(target.id);
          await tx.university_email_domains.update({
            where: { id: target.id },
            data: {
              domain: item.domain,
              is_active: item.is_active !== false,
              is_primary: Boolean(item.is_primary),
              updated_at: new Date(),
            },
          });
        } else {
          const created = await tx.university_email_domains.create({
            data: {
              university_id: id,
              domain: item.domain,
              is_active: item.is_active !== false,
              is_primary: Boolean(item.is_primary),
            },
            select: { id: true },
          });
          keepIds.add(created.id);
        }
      }

      const toDeactivate = existing.filter((d) => !keepIds.has(d.id) && d.is_active);
      if (toDeactivate.length) {
        await tx.university_email_domains.updateMany({
          where: { id: { in: toDeactivate.map((d) => d.id) } },
          data: { is_active: false, is_primary: false, updated_at: new Date() },
        });
      }
    }

    if (specialties !== undefined) {
      const existing = await tx.university_specialties.findMany({
        where: { university_id: id },
        select: { id: true, code: true, status: true },
      });
      const existingById = new Map(existing.map((s) => [s.id, s]));
      const existingByCode = new Map(existing.map((s) => [String(s.code).toUpperCase(), s]));
      const keepIds = new Set();

      for (const item of specialties) {
        const byId = item.id ? existingById.get(item.id) : null;
        const byCode = existingByCode.get(String(item.code).toUpperCase());
        const target = byId || byCode || null;

        if (target) {
          keepIds.add(target.id);
          await tx.university_specialties.update({
            where: { id: target.id },
            data: {
              name_ar: item.name_ar,
              name_en: item.name_en ?? null,
              code: item.code,
              college_name_ar: item.college_name_ar ?? null,
              college_name_en: item.college_name_en ?? null,
              specialty_id: item.specialty_id === undefined ? undefined : item.specialty_id,
              status: item.status ?? 'active',
              updated_at: new Date(),
            },
          });
        } else {
          const created = await tx.university_specialties.create({
            data: {
              university_id: id,
              name_ar: item.name_ar,
              name_en: item.name_en ?? null,
              code: item.code,
              college_name_ar: item.college_name_ar ?? null,
              college_name_en: item.college_name_en ?? null,
              specialty_id: item.specialty_id ?? null,
              status: item.status ?? 'active',
            },
            select: { id: true },
          });
          keepIds.add(created.id);
        }
      }

      const toDeactivate = existing.filter((s) => !keepIds.has(s.id) && s.status === 'active');
      if (toDeactivate.length) {
        await tx.university_specialties.updateMany({
          where: { id: { in: toDeactivate.map((s) => s.id) } },
          data: { status: 'inactive', updated_at: new Date() },
        });
      }
    }

    const full = await tx.universities.findFirst({
      where: { id },
      select: { ...universitySelect, ...detailInclude },
    });
    return mapUniversityRow(full, { includeRelations: true });
  });
}

module.exports = {
  findAllOrdered,
  findById,
  findByName,
  findByCode,
  findActiveDomainElsewhere,
  countLinkedUsers,
  countLinkedMicroCredentials,
  countUsersOnSpecialty,
  createUniversityWithRelations,
  updateUniversityWithRelations,
  mapUniversityRow,
};
