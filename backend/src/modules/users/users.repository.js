const { prisma } = require('../../config/db');

const publicUserSelect = {
  id: true,
  email: true,
  full_name: true,
  primary_university_id: true,
  phone: true,
  status: true,
  created_at: true,
};

function findMany(take = 50) {
  return prisma.users.findMany({
    take,
    orderBy: { created_at: 'desc' },
    select: publicUserSelect,
  });
}

module.exports = { findMany };
