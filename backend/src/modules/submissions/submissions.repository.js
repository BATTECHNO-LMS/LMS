const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('../analytics/prismaMissingTable.js');
const { mapAcademicSubmissionUniqueConflict } = require('./submissions.lifecycle');

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

/**
 * Lookup by canonical uniqueness key (assessment_id + student_id).
 * Uses compound unique when available; falls back to findFirst if client not regenerated.
 */
async function findByAssessmentAndStudent(assessmentId, studentId) {
  try {
    return await prisma.submissions.findUnique({
      where: {
        assessment_id_student_id: {
          assessment_id: assessmentId,
          student_id: studentId,
        },
      },
      include: submissionInclude,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, SUBMISSIONS)) return null;
    if (e && (e.code === 'P2022' || /assessment_id_student_id|Unknown arg/i.test(String(e.message)))) {
      return prisma.submissions.findFirst({
        where: { assessment_id: assessmentId, student_id: studentId },
        orderBy: { submitted_at: 'desc' },
        include: submissionInclude,
      });
    }
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
    const conflict = mapAcademicSubmissionUniqueConflict(e);
    if (conflict) throw conflict;
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
  findByAssessmentAndStudent,
  create,
  update,
  findLatestGradeForStudentAssessment,
  findAnyFinalGrade,
};
