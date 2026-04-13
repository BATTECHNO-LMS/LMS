const { prisma } = require('../../config/db');

async function findMany(where = {}, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  const rows = await prisma.rubrics.findMany({
    where,
    orderBy: { updated_at: 'desc' },
    skip,
    take,
    include: {
      _count: { select: { rubric_criteria: true } },
    },
  });
  return rows;
}

async function findById(id) {
  return prisma.rubrics.findUnique({
    where: { id },
    include: {
      rubric_criteria: { orderBy: { created_at: 'asc' } },
    },
  });
}

async function create(data) {
  return prisma.rubrics.create({ data });
}

async function update(id, data) {
  return prisma.rubrics.update({ where: { id }, data });
}

async function sumCriteriaWeights(rubricId) {
  const agg = await prisma.rubric_criteria.aggregate({
    where: { rubric_id: rubricId },
    _sum: { weight: true },
  });
  return agg._sum.weight != null ? Number(agg._sum.weight) : 0;
}

async function findCriterionById(id) {
  return prisma.rubric_criteria.findUnique({ where: { id } });
}

async function findCriteriaByRubric(rubricId) {
  return prisma.rubric_criteria.findMany({
    where: { rubric_id: rubricId },
    orderBy: { created_at: 'asc' },
  });
}

async function createCriterion(data) {
  return prisma.rubric_criteria.create({ data });
}

async function updateCriterion(id, data) {
  return prisma.rubric_criteria.update({ where: { id }, data });
}

async function deleteCriterion(id) {
  return prisma.rubric_criteria.delete({ where: { id } });
}

async function countAssessmentsUsingRubric(rubricId) {
  return prisma.assessments.count({ where: { rubric_id: rubricId } });
}

module.exports = {
  findMany,
  findById,
  create,
  update,
  sumCriteriaWeights,
  findCriterionById,
  findCriteriaByRubric,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  countAssessmentsUsingRubric,
};
