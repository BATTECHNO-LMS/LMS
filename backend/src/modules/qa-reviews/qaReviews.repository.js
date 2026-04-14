const { prisma } = require('../../config/db');

async function count(where) {
  return prisma.qa_reviews.count({ where });
}

async function findMany(where, { skip = 0, take = 200 } = {}) {
  return prisma.qa_reviews.findMany({
    where,
    orderBy: [{ review_date: 'desc' }, { created_at: 'desc' }],
    skip,
    take,
  });
}

async function findById(id) {
  return prisma.qa_reviews.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.qa_reviews.create({ data });
}

async function update(id, data) {
  return prisma.qa_reviews.update({ where: { id }, data });
}

async function findCorrectiveByQaReview(qaReviewId) {
  return prisma.corrective_actions.findMany({
    where: { qa_review_id: qaReviewId },
    orderBy: { due_date: 'asc' },
  });
}

module.exports = { count, findMany, findById, create, update, findCorrectiveByQaReview };
