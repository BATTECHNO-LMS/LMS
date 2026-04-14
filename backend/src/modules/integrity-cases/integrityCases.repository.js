const { prisma } = require('../../config/db');

async function count(where) {
  return prisma.integrity_cases.count({ where });
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.integrity_cases.findMany({
    where,
    orderBy: { created_at: 'desc' },
    skip,
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

module.exports = { count, findMany, findById, create, update };
