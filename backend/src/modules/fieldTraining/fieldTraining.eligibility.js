const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');

const ELIGIBILITY_SETUP_MSG = 'هذه الفرصة تحتاج تحديد الجامعات والتخصصات المؤهلة.';
const ELIGIBILITY_UNIVERSITY_REQUIRED_MSG = 'يرجى اختيار جامعة واحدة على الأقل.';
const ELIGIBILITY_SPECIALTY_REQUIRED_MSG = 'يرجى اختيار تخصص واحد على الأقل لهذه الفرصة.';
const ELIGIBILITY_PUBLISH_REQUIRED_MSG =
  'لا يمكن نشر الفرصة بدون تحديد الجامعات والتخصصات المؤهلة.';

/**
 * @typedef {{ university_id: string, university_specialty_id: string, seats_limit?: number | null, is_active?: boolean }} EligibilityInput
 */

async function loadUniversitySpecialtyRow(universitySpecialtyId, universityId) {
  return prisma.university_specialties.findFirst({
    where: {
      id: universitySpecialtyId,
      university_id: universityId,
      status: 'active',
    },
    select: {
      id: true,
      university_id: true,
      specialty_id: true,
      name_ar: true,
      name_en: true,
      code: true,
    },
  });
}

/**
 * @param {EligibilityInput[]} rows
 */
async function validateEligibilityRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new ApiError(
      400,
      ELIGIBILITY_SPECIALTY_REQUIRED_MSG,
      null,
      'FIELD_TRAINING_ELIGIBILITY_REQUIRED'
    );
  }

  const seen = new Set();
  const normalized = [];

  for (const row of rows) {
    const key = `${row.university_id}:${row.university_specialty_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const university = await prisma.universities.findFirst({
      where: { id: row.university_id, status: 'active' },
      select: { id: true },
    });
    if (!university) {
      throw new ApiError(400, 'إحدى الجامعات المحددة غير متاحة.', null, 'FIELD_TRAINING_INVALID_UNIVERSITY');
    }

    const universitySpecialty = await loadUniversitySpecialtyRow(
      row.university_specialty_id,
      row.university_id
    );
    if (!universitySpecialty) {
      throw new ApiError(
        400,
        'التخصص المحدد غير مرتبط بالجامعة المختارة.',
        null,
        'FIELD_TRAINING_INVALID_UNIVERSITY_SPECIALTY'
      );
    }

    if (row.seats_limit != null && Number(row.seats_limit) < 1) {
      throw new ApiError(
        400,
        'عدد المقاعد لكل تخصص يجب أن يكون رقماً موجباً.',
        null,
        'FIELD_TRAINING_INVALID_SEATS_LIMIT'
      );
    }

    normalized.push({
      university_id: university.id,
      university_specialty_id: universitySpecialty.id,
      canonical_specialty_id: universitySpecialty.specialty_id ?? null,
      seats_limit: row.seats_limit ?? null,
      is_active: row.is_active !== false,
    });
  }

  if (!normalized.length) {
    throw new ApiError(
      400,
      ELIGIBILITY_SPECIALTY_REQUIRED_MSG,
      null,
      'FIELD_TRAINING_ELIGIBILITY_REQUIRED'
    );
  }

  const universityIds = new Set(normalized.map((row) => row.university_id));
  if (universityIds.size < 1) {
    throw new ApiError(
      400,
      ELIGIBILITY_UNIVERSITY_REQUIRED_MSG,
      null,
      'FIELD_TRAINING_ELIGIBILITY_UNIVERSITY_REQUIRED'
    );
  }

  return normalized;
}

/**
 * @param {string} opportunityId
 * @param {Awaited<ReturnType<typeof validateEligibilityRows>>} rows
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
async function syncOpportunityEligibility(opportunityId, rows, tx = prisma) {
  const desiredKeys = new Set(rows.map((r) => `${r.university_id}:${r.university_specialty_id}`));
  const existing = await tx.field_training_opportunity_eligibility.findMany({
    where: { opportunity_id: opportunityId },
    select: { id: true, university_id: true, university_specialty_id: true },
  });

  for (const row of existing) {
    const key = `${row.university_id}:${row.university_specialty_id}`;
    if (!desiredKeys.has(key)) {
      await tx.field_training_opportunity_eligibility.update({
        where: { id: row.id },
        data: { is_active: false, updated_at: new Date() },
      });
    }
  }

  for (const row of rows) {
    const existingRow = await tx.field_training_opportunity_eligibility.findFirst({
      where: {
        opportunity_id: opportunityId,
        university_id: row.university_id,
        university_specialty_id: row.university_specialty_id,
      },
    });

    const data = {
      canonical_specialty_id: row.canonical_specialty_id,
      seats_limit: row.seats_limit,
      is_active: row.is_active,
      updated_at: new Date(),
    };

    if (existingRow) {
      await tx.field_training_opportunity_eligibility.update({
        where: { id: existingRow.id },
        data,
      });
    } else {
      await tx.field_training_opportunity_eligibility.create({
        data: {
          opportunity_id: opportunityId,
          university_id: row.university_id,
          university_specialty_id: row.university_specialty_id,
          ...data,
        },
      });
    }
  }
}

async function countActiveEligibility(opportunityId) {
  return prisma.field_training_opportunity_eligibility.count({
    where: { opportunity_id: opportunityId, is_active: true },
  });
}

async function countActiveByOpportunityIds(opportunityIds) {
  if (!opportunityIds.length) return {};
  const rows = await prisma.field_training_opportunity_eligibility.groupBy({
    by: ['opportunity_id'],
    where: { opportunity_id: { in: opportunityIds }, is_active: true },
    _count: { id: true },
  });
  return Object.fromEntries(rows.map((row) => [row.opportunity_id, row._count.id]));
}

async function summarizeEligibilityByOpportunityIds(opportunityIds) {
  if (!opportunityIds.length) return {};
  const rows = await prisma.field_training_opportunity_eligibility.findMany({
    where: { opportunity_id: { in: opportunityIds }, is_active: true },
    select: { opportunity_id: true, university_id: true, university_specialty_id: true },
  });
  const map = {};
  for (const row of rows) {
    if (!map[row.opportunity_id]) {
      map[row.opportunity_id] = { universities: new Set(), specialties: new Set() };
    }
    map[row.opportunity_id].universities.add(row.university_id);
    map[row.opportunity_id].specialties.add(row.university_specialty_id);
  }
  return Object.fromEntries(
    Object.entries(map).map(([id, value]) => [
      id,
      {
        beneficiary_university_count: value.universities.size,
        eligible_specialty_count: value.specialties.size,
      },
    ])
  );
}

async function hasActiveEligibilityForUniversity(opportunityId, universityId) {
  const row = await prisma.field_training_opportunity_eligibility.findFirst({
    where: { opportunity_id: opportunityId, university_id: universityId, is_active: true },
    select: { id: true },
  });
  return Boolean(row);
}

async function isStudentEligible(opportunityId, universityId, universitySpecialtyId) {
  const row = await prisma.field_training_opportunity_eligibility.findFirst({
    where: {
      opportunity_id: opportunityId,
      university_id: universityId,
      university_specialty_id: universitySpecialtyId,
      is_active: true,
    },
    select: { id: true },
  });
  return Boolean(row);
}

function groupEligibilityByUniversity(eligibilityRows, applicationCountsBySpecialty = {}) {
  const byUniversity = new Map();
  for (const row of eligibilityRows) {
    const universityId = row.university_id;
    if (!byUniversity.has(universityId)) {
      byUniversity.set(universityId, {
        university_id: universityId,
        university: row.university,
        programs: [],
        application_count: 0,
      });
    }
    const entry = byUniversity.get(universityId);
    const programCount = applicationCountsBySpecialty[row.university_specialty_id] ?? 0;
    entry.programs.push({
      eligibility_id: row.id,
      university_specialty_id: row.university_specialty_id,
      university_specialty: row.university_specialty,
      canonical_specialty: row.canonical_specialty,
      seats_limit: row.seats_limit ?? null,
      application_count: programCount,
    });
    entry.application_count += programCount;
  }
  return [...byUniversity.values()];
}

function mapEligibilityRow(row) {
  return {
    id: row.id,
    opportunity_id: row.opportunity_id,
    university_id: row.university_id,
    university_specialty_id: row.university_specialty_id,
    canonical_specialty_id: row.canonical_specialty_id ?? null,
    seats_limit: row.seats_limit ?? null,
    is_active: row.is_active,
    university: row.universities
      ? { id: row.universities.id, name: row.universities.name }
      : null,
    university_specialty: row.university_specialties
      ? {
          id: row.university_specialties.id,
          name_ar: row.university_specialties.name_ar,
          name_en: row.university_specialties.name_en,
          code: row.university_specialties.code,
        }
      : null,
    canonical_specialty: row.specialties
      ? {
          id: row.specialties.id,
          name_ar: row.specialties.name_ar,
          name_en: row.specialties.name_en,
          code: row.specialties.code ?? null,
        }
      : null,
  };
}

async function findActiveByOpportunityId(opportunityId) {
  const rows = await prisma.field_training_opportunity_eligibility.findMany({
    where: { opportunity_id: opportunityId, is_active: true },
    include: {
      universities: { select: { id: true, name: true } },
      university_specialties: {
        select: { id: true, name_ar: true, name_en: true, code: true, status: true },
      },
      specialties: {
        select: { id: true, name_ar: true, name_en: true, code: true, status: true },
      },
    },
    orderBy: [{ universities: { name: 'asc' } }, { university_specialties: { name_ar: 'asc' } }],
  });
  return rows.map(mapEligibilityRow);
}

async function findEligibilityCatalog() {
  const universities = await prisma.universities.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      university_specialties: {
        where: { status: 'active' },
        select: {
          id: true,
          name_ar: true,
          name_en: true,
          code: true,
          specialty_id: true,
          college_name_ar: true,
          college_name_en: true,
        },
        orderBy: { name_ar: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return universities
    .filter((u) => u.university_specialties.length > 0)
    .map((u) => ({
      id: u.id,
      name: u.name,
      specialties: u.university_specialties.map((s) => ({
        id: s.id,
        nameAr: s.name_ar,
        nameEn: s.name_en,
        code: s.code,
        collegeNameAr: s.college_name_ar,
        collegeNameEn: s.college_name_en,
        canonicalSpecialtyId: s.specialty_id,
      })),
    }));
}

module.exports = {
  ELIGIBILITY_SETUP_MSG,
  ELIGIBILITY_PUBLISH_REQUIRED_MSG,
  validateEligibilityRows,
  syncOpportunityEligibility,
  countActiveEligibility,
  countActiveByOpportunityIds,
  summarizeEligibilityByOpportunityIds,
  hasActiveEligibilityForUniversity,
  groupEligibilityByUniversity,
  isStudentEligible,
  findActiveByOpportunityId,
  findEligibilityCatalog,
  mapEligibilityRow,
};
