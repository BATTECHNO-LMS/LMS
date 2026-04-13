const { prisma } = require('../../config/db');

const assessmentInclude = {
  cohorts: { select: { id: true, title: true, status: true, university_id: true, instructor_id: true } },
  micro_credentials: { select: { id: true, title: true, code: true, status: true } },
  learning_outcomes: { select: { id: true, outcome_code: true, outcome_text: true } },
  rubrics: { select: { id: true, title: true, status: true } },
};

/**
 * @param {import('@prisma/client').Prisma.assessmentsWhereInput} where
 * @param {{ skip?: number, take?: number }} [opts]
 */
async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  return prisma.assessments.findMany({
    where,
    orderBy: { due_date: 'desc' },
    skip,
    take,
    include: assessmentInclude,
  });
}

async function findById(id) {
  return prisma.assessments.findUnique({
    where: { id },
    include: assessmentInclude,
  });
}

async function create(data) {
  return prisma.assessments.create({
    data,
    include: assessmentInclude,
  });
}

async function update(id, data) {
  return prisma.assessments.update({
    where: { id },
    data,
    include: assessmentInclude,
  });
}

/**
 * Sum weights for cohort excluding archived assessments.
 * @param {string} cohortId
 * @param {string} [excludeAssessmentId]
 */
async function sumWeightsForCohort(cohortId, excludeAssessmentId) {
  const agg = await prisma.assessments.aggregate({
    where: {
      cohort_id: cohortId,
      status: { not: 'archived' },
      ...(excludeAssessmentId ? { id: { not: excludeAssessmentId } } : {}),
    },
    _sum: { weight: true },
  });
  return agg._sum.weight != null ? Number(agg._sum.weight) : 0;
}

async function countSubmissions(assessmentId) {
  return prisma.submissions.count({ where: { assessment_id: assessmentId } });
}

async function countGrades(assessmentId) {
  return prisma.grades.count({ where: { assessment_id: assessmentId } });
}

async function findCohortById(cohortId) {
  return prisma.cohorts.findUnique({ where: { id: cohortId } });
}

async function findLearningOutcome(id) {
  return prisma.learning_outcomes.findUnique({ where: { id } });
}

async function findRubric(id) {
  return prisma.rubrics.findUnique({ where: { id } });
}

module.exports = {
  findMany,
  findById,
  create,
  update,
  sumWeightsForCohort,
  countSubmissions,
  countGrades,
  findCohortById,
  findLearningOutcome,
  findRubric,
};
