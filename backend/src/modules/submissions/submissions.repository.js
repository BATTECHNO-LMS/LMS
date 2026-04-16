const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('../analytics/prismaMissingTable.js');

const SUBMISSIONS = 'submissions';
const GRADES = 'grades';

function missingSubmissionsTableError() {
  const err = new Error('Submissions table is missing. Apply Prisma migrations (submissions).');
  err.code = 'SUBMISSIONS_TABLE_MISSING';
  return err;
}

function missingGradesTableError() {
  const err = new Error('Grades table is missing. Apply Prisma migrations (grades).');
  err.code = 'GRADES_TABLE_MISSING';
  return err;
}

const submissionInclude = {
  assessments: {
    include: {
      cohorts: { select: { id: true, title: true } },
    },
  },
};

async function findMany(where, opts = {}) {
  const { skip = 0, take = 200 } = opts;
  try {
    return await prisma.submissions.findMany({
      where,
      orderBy: { submitted_at: 'desc' },
      skip,
      take,
      include: submissionInclude,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, SUBMISSIONS)) return [];
    throw e;
  }
}

async function findById(id) {
  try {
    return await prisma.submissions.findUnique({
      where: { id },
      include: submissionInclude,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, SUBMISSIONS)) return null;
    throw e;
  }
}

async function create(data) {
  try {
    return await prisma.submissions.create({
      data,
      include: submissionInclude,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, SUBMISSIONS)) throw missingSubmissionsTableError();
    throw e;
  }
}

async function update(id, data) {
  try {
    return await prisma.submissions.update({
      where: { id },
      data,
      include: submissionInclude,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, SUBMISSIONS)) throw missingSubmissionsTableError();
    throw e;
  }
}

async function findLatestGradeForStudentAssessment(assessmentId, studentId) {
  try {
    return await prisma.grades.findFirst({
      where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, GRADES)) return null;
    throw e;
  }
}

async function findAnyFinalGrade(assessmentId, studentId) {
  try {
    return await prisma.grades.findFirst({
      where: { assessment_id: assessmentId, student_id: studentId, is_final: true },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, GRADES)) return null;
    throw e;
  }
}

module.exports = {
  findMany,
  findById,
  create,
  update,
  findLatestGradeForStudentAssessment,
  findAnyFinalGrade,
};
