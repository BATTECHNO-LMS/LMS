const { prisma } = require('../../config/db');

async function count(where) {
  return prisma.corrective_actions.count({ where });
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.corrective_actions.findMany({
    where,
    orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
    skip,
    take,
  });
}

async function findById(id) {
  return prisma.corrective_actions.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.corrective_actions.create({ data });
}

async function update(id, data) {
  return prisma.corrective_actions.update({ where: { id }, data });
}

async function findQaReviewById(id) {
  return prisma.qa_reviews.findUnique({ where: { id } });
}

module.exports = { count, findMany, findById, create, update, findQaReviewById };
