const { prisma } = require('../../config/db');
const { isMissingPrismaModelTableError } = require('../analytics/prismaMissingTable.js');

const MODEL = 'attendance_records';

function missingTableError() {
  const err = new Error(
    'Attendance table is missing. Apply Prisma migrations (attendance_records).'
  );
  err.code = 'ATTENDANCE_TABLE_MISSING';
  return err;
}

async function findBySessionAndStudent(sessionId, studentId) {
  try {
    return await prisma.attendance_records.findFirst({
      where: { session_id: sessionId, student_id: studentId },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) return null;
    throw e;
  }
}

async function findManyBySession(sessionId) {
  try {
    return await prisma.attendance_records.findMany({
      where: { session_id: sessionId },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) return [];
    throw e;
  }
}

async function upsertRecord({ session_id, student_id, attendance_status, notes }) {
  try {
    const existing = await prisma.attendance_records.findFirst({
      where: { session_id, student_id },
    });
    if (existing) {
      return await prisma.attendance_records.update({
        where: { id: existing.id },
        data: {
          attendance_status,
          notes: notes ?? null,
          updated_at: new Date(),
        },
      });
    }
    return await prisma.attendance_records.create({
      data: {
        session_id,
        student_id,
        attendance_status,
        notes: notes ?? null,
      },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) throw missingTableError();
    throw e;
  }
}

async function findById(id) {
  try {
    return await prisma.attendance_records.findUnique({ where: { id } });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) return null;
    throw e;
  }
}

async function updateRecord(id, data) {
  try {
    return await prisma.attendance_records.update({ where: { id }, data });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) throw missingTableError();
    throw e;
  }
}

async function sessionIdsForCohort(cohortId) {
  const rows = await prisma.sessions.findMany({
    where: { cohort_id: cohortId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function findRecordsForSessionsAndStudent(sessionIds, studentId) {
  if (!sessionIds.length) return [];
  try {
    return await prisma.attendance_records.findMany({
      where: {
        student_id: studentId,
        session_id: { in: sessionIds },
      },
      select: { session_id: true, attendance_status: true },
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) return [];
    throw e;
  }
}

/** Cohort summary: all records for many sessions (read-only; empty if table missing). */
async function findManyBySessionIdsForSummary(sessionIds, select) {
  if (!sessionIds.length) return [];
  try {
    return await prisma.attendance_records.findMany({
      where: { session_id: { in: sessionIds } },
      select,
    });
  } catch (e) {
    if (isMissingPrismaModelTableError(e, MODEL)) return [];
    throw e;
  }
}

module.exports = {
  findBySessionAndStudent,
  findManyBySession,
  upsertRecord,
  findById,
  updateRecord,
  sessionIdsForCohort,
  findRecordsForSessionsAndStudent,
  findManyBySessionIdsForSummary,
};
