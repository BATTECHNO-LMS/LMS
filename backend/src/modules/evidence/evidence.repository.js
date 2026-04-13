const { prisma } = require('../../config/db');

/**
 * @param {import('@prisma/client').Prisma.evidence_filesWhereInput} where
 * @param {{ take?: number }} [opts]
 */
async function findMany(where, { take = 200 } = {}) {
  return prisma.evidence_files.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
  });
}

async function findById(id) {
  return prisma.evidence_files.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.evidence_files.create({ data });
}

async function update(id, data) {
  return prisma.evidence_files.update({ where: { id }, data });
}

module.exports = { findMany, findById, create, update };
