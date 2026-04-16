const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('../analytics/prismaMissingTable.js');

const gradeInclude = {
  assessments: {
    include: {
      cohorts: { select: { id: true, title: true, university_id: true, instructor_id: true } },
    },
  },
};

/** `grades.findMany` + include touches assessments/cohorts — any missing yields P2021 on that table. */
function isMissingGradesListSchemaTable(err) {
  return (
    isMissingPrismaModelTableError(err, 'grades') ||
    isMissingPrismaModelTableError(err, 'assessments') ||
    isMissingPrismaModelTableError(err, 'cohorts')
  );
}

function missingGradesSchemaError() {
  const err = new Error(
    'Grading schema is incomplete. Apply Prisma migrations (grades, assessments, cohorts).'
  );
  err.code = 'GRADES_SCHEMA_MISSING';
  return err;
}

async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  try {
    return await prisma.grades.findMany({
      where,
      orderBy: { graded_at: 'desc' },
      skip,
      take,
      include: gradeInclude,
    });
  } catch (e) {
    if (isMissingGradesListSchemaTable(e)) return [];
    throw e;
  }
}

async function findById(id) {
  try {
    return await prisma.grades.findUnique({
      where: { id },
      include: gradeInclude,
    });
  } catch (e) {
    if (isMissingGradesListSchemaTable(e)) return null;
    throw e;
  }
}

async function create(data) {
  try {
    return await prisma.grades.create({
      data,
      include: gradeInclude,
    });
  } catch (e) {
    if (isMissingGradesListSchemaTable(e)) throw missingGradesSchemaError();
    throw e;
  }
}

async function update(id, data) {
  try {
    return await prisma.grades.update({
      where: { id },
      data,
      include: gradeInclude,
    });
  } catch (e) {
    if (isMissingGradesListSchemaTable(e)) throw missingGradesSchemaError();
    throw e;
  }
}

async function countSubmissionsForStudent(assessmentId, studentId) {
  try {
    return await prisma.submissions.count({
      where: { assessment_id: assessmentId, student_id: studentId },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'submissions')) return 0;
    if (isMissingPrismaModelTableError(e, 'assessments')) return 0;
    throw e;
  }
}

async function findGradesForPair(assessmentId, studentId) {
  try {
    return await prisma.grades.findMany({
      where: { assessment_id: assessmentId, student_id: studentId },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'grades')) return [];
    throw e;
  }
}

async function setAllNonFinalForPair(assessmentId, studentId) {
  try {
    await prisma.grades.updateMany({
      where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
      data: { is_final: false },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, 'grades')) return;
    throw e;
  }
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
