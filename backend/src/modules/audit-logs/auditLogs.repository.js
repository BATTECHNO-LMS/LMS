const { prisma } = require('../../config/db');

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.audit_logs.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
    take,
  });
}

async function findById(id) {
  return prisma.audit_logs.findUnique({ where: { id } });
}

module.exports = { findMany, findById };
