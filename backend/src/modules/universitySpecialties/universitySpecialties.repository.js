const { prisma } = require('../../config/db');

async function findActiveByUniversityId(universityId) {
  return prisma.university_specialties.findMany({
    where: {
      university_id: universityId,
      status: 'active',
    },
    select: {
      id: true,
      name_ar: true,
      name_en: true,
      code: true,
      college_name_ar: true,
      college_name_en: true,
      specialty_id: true,
    },
    orderBy: [{ name_ar: 'asc' }],
  });
}

async function findActiveByIdForUniversity(universitySpecialtyId, universityId) {
  return prisma.university_specialties.findFirst({
    where: {
      id: universitySpecialtyId,
      university_id: universityId,
      status: 'active',
    },
    select: {
      id: true,
      university_id: true,
      name_ar: true,
      name_en: true,
      code: true,
      specialty_id: true,
      status: true,
    },
  });
}

module.exports = {
  findActiveByUniversityId,
  findActiveByIdForUniversity,
};
