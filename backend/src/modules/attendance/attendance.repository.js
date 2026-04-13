const { prisma } = require('../../config/db');

async function findBySessionAndStudent(sessionId, studentId) {
  return prisma.attendance_records.findFirst({
    where: { session_id: sessionId, student_id: studentId },
  });
}

async function findManyBySession(sessionId) {
  return prisma.attendance_records.findMany({
    where: { session_id: sessionId },
  });
}

async function upsertRecord({ session_id, student_id, attendance_status, notes }) {
  const existing = await prisma.attendance_records.findFirst({
    where: { session_id, student_id },
  });
  if (existing) {
    return prisma.attendance_records.update({
      where: { id: existing.id },
      data: {
        attendance_status,
        notes: notes ?? null,
        updated_at: new Date(),
      },
    });
  }
  return prisma.attendance_records.create({
    data: {
      session_id,
      student_id,
      attendance_status,
      notes: notes ?? null,
    },
  });
}

async function findById(id) {
  return prisma.attendance_records.findUnique({ where: { id } });
}

async function updateRecord(id, data) {
  return prisma.attendance_records.update({ where: { id }, data });
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
  return prisma.attendance_records.findMany({
    where: {
      student_id: studentId,
      session_id: { in: sessionIds },
    },
    select: { session_id: true, attendance_status: true },
  });
}

module.exports = {
  findBySessionAndStudent,
  findManyBySession,
  upsertRecord,
  findById,
  updateRecord,
  sessionIdsForCohort,
  findRecordsForSessionsAndStudent,
};
