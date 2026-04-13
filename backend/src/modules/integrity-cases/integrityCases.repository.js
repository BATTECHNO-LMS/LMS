const { prisma } = require('../../config/db');

async function findMany(where, { take = 200 } = {}) {
  return prisma.integrity_cases.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
  });
}

async function findById(id) {
  return prisma.integrity_cases.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.integrity_cases.create({ data });
}

async function update(id, data) {
  return prisma.integrity_cases.update({ where: { id }, data });
}

module.exports = { findMany, findById, create, update };
