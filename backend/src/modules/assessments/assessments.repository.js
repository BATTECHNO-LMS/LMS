const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');

const assessmentInclude = {
  cohorts: { select: { id: true, title: true, status: true, university_id: true, instructor_id: true } },
  micro_credentials: { select: { id: true, title: true, code: true, status: true } },
  learning_outcomes: { select: { id: true, outcome_code: true, outcome_text: true } },
  rubrics: { select: { id: true, title: true, status: true } },
};

function isMissingTableError(err, tableName) {
  const msg = String(err?.message || '').toLowerCase();
  return err?.code === 'P2021' || msg.includes('does not exist') || msg.includes(`public.${tableName}`.toLowerCase());
}

/**
 * @param {import('@prisma/client').Prisma.assessmentsWhereInput} where
 * @param {{ skip?: number, take?: number }} [opts]
 */
async function count(where) {
  try {
    return await prisma.assessments.count({ where });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) return 0;
    throw err;
  }
}

async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  try {
    return await prisma.assessments.findMany({
      where,
      orderBy: { due_date: 'desc' },
      skip,
      take,
      include: assessmentInclude,
    });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) return [];
    throw err;
  }
}

async function findById(id) {
  try {
    return await prisma.assessments.findUnique({
      where: { id },
      include: assessmentInclude,
    });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) return null;
    throw err;
  }
}

async function create(data) {
  try {
    return await prisma.assessments.create({
      data,
      include: assessmentInclude,
    });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) {
      throw new ApiError(
        503,
        'The assessments table is missing on this database. From the backend folder run: npx prisma migrate deploy',
        undefined,
        'ASSESSMENTS_TABLE_MISSING'
      );
    }
    throw err;
  }
}

async function update(id, data) {
  try {
    return await prisma.assessments.update({
      where: { id },
      data,
      include: assessmentInclude,
    });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) {
      throw new ApiError(
        503,
        'The assessments table is missing on this database. From the backend folder run: npx prisma migrate deploy',
        undefined,
        'ASSESSMENTS_TABLE_MISSING'
      );
    }
    throw err;
  }
}

/**
 * Sum weights for cohort excluding archived assessments.
 * @param {string} cohortId
 * @param {string} [excludeAssessmentId]
 */
async function sumWeightsForCohort(cohortId, excludeAssessmentId) {
  let agg;
  try {
    agg = await prisma.assessments.aggregate({
      where: {
        cohort_id: cohortId,
        status: { not: 'archived' },
        ...(excludeAssessmentId ? { id: { not: excludeAssessmentId } } : {}),
      },
      _sum: { weight: true },
    });
  } catch (err) {
    if (isMissingTableError(err, 'assessments')) return 0;
    throw err;
  }
  return agg._sum.weight != null ? Number(agg._sum.weight) : 0;
}

async function countSubmissions(assessmentId) {
  try {
    return await prisma.submissions.count({ where: { assessment_id: assessmentId } });
  } catch (err) {
    if (isMissingTableError(err, 'submissions')) return 0;
    throw err;
  }
}

async function countGrades(assessmentId) {
  try {
    return await prisma.grades.count({ where: { assessment_id: assessmentId } });
  } catch (err) {
    if (isMissingTableError(err, 'grades')) return 0;
    throw err;
  }
}

async function findCohortById(cohortId) {
  try {
    return await prisma.cohorts.findUnique({ where: { id: cohortId } });
  } catch (err) {
    if (isMissingTableError(err, 'cohorts')) return null;
    throw err;
  }
}

async function findLearningOutcome(id) {
  try {
    return await prisma.learning_outcomes.findUnique({ where: { id } });
  } catch (err) {
    if (isMissingTableError(err, 'learning_outcomes')) return null;
    throw err;
  }
}

async function findRubric(id) {
  try {
    return await prisma.rubrics.findUnique({ where: { id } });
  } catch (err) {
    if (isMissingTableError(err, 'rubrics')) return null;
    throw err;
  }
}

module.exports = {
  count,
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
