const { prisma } = require('../../config/db');

async function findActiveAll() {
  return prisma.specialties.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name_ar: true,
      name_en: true,
      code: true,
      status: true,
    },
    orderBy: [{ name_ar: 'asc' }],
  });
}

async function findActiveById(specialtyId) {
  return prisma.specialties.findFirst({
    where: { id: specialtyId, status: 'active' },
    select: {
      id: true,
      name_ar: true,
      name_en: true,
      code: true,
      status: true,
    },
  });
}

module.exports = {
  findActiveAll,
  findActiveById,
};
