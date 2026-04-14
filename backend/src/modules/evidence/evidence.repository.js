const { prisma } = require('../../config/db');

async function count(where) {
  return prisma.evidence_files.count({ where });
}

/**
 * @param {import('@prisma/client').Prisma.evidence_filesWhereInput} where
 * @param {{ skip?: number, take?: number }} [opts]
 */
async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.evidence_files.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
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

module.exports = { count, findMany, findById, create, update };
