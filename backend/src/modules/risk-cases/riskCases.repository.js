const { prisma } = require('../../config/db');

async function findMany(where, { take = 200 } = {}) {
  return prisma.risk_cases.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take,
  });
}

async function findById(id) {
  return prisma.risk_cases.findUnique({ where: { id } });
}

async function create(data) {
  return prisma.risk_cases.create({ data });
}

async function update(id, data) {
  return prisma.risk_cases.update({ where: { id }, data });
}

async function countOpenByTypeStudentCohort(cohortId, studentId, riskType) {
  return prisma.risk_cases.count({
    where: {
      cohort_id: cohortId,
      student_id: studentId,
      risk_type: riskType,
      status: { in: ['open', 'in_progress', 'escalated'] },
    },
  });
}

module.exports = { findMany, findById, create, update, countOpenByTypeStudentCohort };
