const { prisma } = require('../../config/db');

function findAllActive() {
  return prisma.universities.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      partnership_state: true,
    },
    orderBy: { name: 'asc' },
  });
}

module.exports = { findAllActive };
