const { prisma } = require('../../config/db');

async function findMany(where, { take = 200 } = {}) {
  return prisma.corrective_actions.findMany({
    where,
    orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
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

module.exports = { findMany, findById, create, update, findQaReviewById };
