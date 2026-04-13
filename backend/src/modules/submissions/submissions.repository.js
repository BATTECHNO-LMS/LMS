const { prisma } = require('../../config/db');

const submissionInclude = {
  assessments: {
    include: {
      cohorts: { select: { id: true, title: true } },
    },
  },
};

async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  return prisma.submissions.findMany({
    where,
    orderBy: { submitted_at: 'desc' },
    skip,
    take,
    include: submissionInclude,
  });
}

async function findById(id) {
  return prisma.submissions.findUnique({
    where: { id },
    include: submissionInclude,
  });
}

async function create(data) {
  return prisma.submissions.create({
    data,
    include: submissionInclude,
  });
}

async function update(id, data) {
  return prisma.submissions.update({
    where: { id },
    data,
    include: submissionInclude,
  });
}

async function findLatestGradeForStudentAssessment(assessmentId, studentId) {
  return prisma.grades.findFirst({
    where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
  });
}

async function findAnyFinalGrade(assessmentId, studentId) {
  return prisma.grades.findFirst({
    where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
  });
}

module.exports = {
  findMany,
  findById,
  create,
  update,
  findLatestGradeForStudentAssessment,
  findAnyFinalGrade,
};
