const { prisma } = require('../../config/db');

const gradeInclude = {
  assessments: {
    include: {
      cohorts: { select: { id: true, title: true, university_id: true, instructor_id: true } },
    },
  },
};

async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  return prisma.grades.findMany({
    where,
    orderBy: { graded_at: 'desc' },
    skip,
    take,
    include: gradeInclude,
  });
}

async function findById(id) {
  return prisma.grades.findUnique({
    where: { id },
    include: gradeInclude,
  });
}

async function create(data) {
  return prisma.grades.create({
    data,
    include: gradeInclude,
  });
}

async function update(id, data) {
  return prisma.grades.update({
    where: { id },
    data,
    include: gradeInclude,
  });
}

async function countSubmissionsForStudent(assessmentId, studentId) {
  return prisma.submissions.count({
    where: { assessment_id: assessmentId, student_id: studentId },
  });
}

async function findGradesForPair(assessmentId, studentId) {
  return prisma.grades.findMany({
    where: { assessment_id: assessmentId, student_id: studentId },
  });
}

async function setAllNonFinalForPair(assessmentId, studentId) {
  await prisma.grades.updateMany({
    where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
    data: { is_final: false },
  });
}

module.exports = {
  findMany,
  findById,
  create,
  update,
  countSubmissionsForStudent,
  findGradesForPair,
  setAllNonFinalForPair,
};
