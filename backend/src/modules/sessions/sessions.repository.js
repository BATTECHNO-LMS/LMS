const { prisma } = require('../../config/db');

async function findManyByCohort(cohortId) {
  return prisma.sessions.findMany({
    where: { cohort_id: cohortId },
    orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
  });
}

async function findById(id) {
  return prisma.sessions.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.sessions.create({ data });
}

async function update(id, data) {
  return prisma.sessions.update({ where: { id }, data });
}

async function findModule(id) {
  return prisma.modules.findUnique({ where: { id } });
}

module.exports = {
  findManyByCohort,
  findById,
  create,
  update,
  findModule,
};
