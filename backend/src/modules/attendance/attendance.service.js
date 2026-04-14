const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { canAccessCohort } = require('../../utils/deliveryAccess');
const attendanceRepository = require('./attendance.repository');
const cohortsRepository = require('../cohorts/cohorts.repository');
const sessionsService = require('../sessions/sessions.service');
const enrollmentsRepository = require('../enrollments/enrollments.repository');
const { dispatchAppEvent } = require('../../shared/services/eventDispatcher.service');

function countsAsAttended(status) {
  return status === 'present' || status === 'late' || status === 'excused';
}

async function recalcCohortAttendancePercentages(cohortId) {
  const sessionIds = await attendanceRepository.sessionIdsForCohort(cohortId);
  const total = sessionIds.length;
  const enrollments = await prisma.enrollments.findMany({
    where: {
      cohort_id: cohortId,
      enrollment_status: { in: ['enrolled', 'pending', 'completed'] },
    },
  });
  const updates = [];
  for (const e of enrollments) {
    const records = await attendanceRepository.findRecordsForSessionsAndStudent(sessionIds, e.student_id);
    const bySession = new Map(records.map((r) => [r.session_id, r.attendance_status]));
    let score = 0;
    for (const sid of sessionIds) {
      const st = bySession.get(sid);
      if (st && countsAsAttended(st)) score += 1;
    }
    const pct = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;
    updates.push(
      prisma.enrollments.update({
        where: { id: e.id },
        data: { attendance_percentage: pct, updated_at: new Date() },
      })
    );
  }
  if (updates.length) await prisma.$transaction(updates);
}

async function emitLowAttendanceIfNeeded(cohortId) {
  const agg = await prisma.enrollments.aggregate({
    where: {
      cohort_id: cohortId,
      enrollment_status: { in: ['enrolled', 'pending', 'completed'] },
    },
    _avg: { attendance_percentage: true },
  });
  const avg = Number(agg._avg.attendance_percentage || 0);
  const threshold = 75;
  if (avg < threshold) {
    await dispatchAppEvent('attendance_below_threshold', {
      cohortId,
      attendanceRate: avg,
      threshold,
    });
  }
}

async function assertSessionAttendanceAccess(sessionId, requester) {
  const sessionRow = await sessionsService.findSessionByIdRaw(sessionId);
  if (!sessionRow) throw new ApiError(404, 'Session not found');
  const cohort = await cohortsRepository.findById(sessionRow.cohort_id);
  if (!cohort || !canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');
  return { session: sessionRow, cohort };
}

async function getSessionAttendance(sessionId, requester) {
  const { session: sessionRow, cohort } = await assertSessionAttendanceAccess(sessionId, requester);
  const enrollRows = await enrollmentsRepository.findManyByCohort(sessionRow.cohort_id);
  const active = enrollRows.filter((e) => !['withdrawn', 'cancelled'].includes(e.enrollment_status));
  const existing = await attendanceRepository.findManyBySession(sessionId);
  const byStudent = new Map(existing.map((r) => [r.student_id, r]));

  const students = await Promise.all(
    active.map(async (e) => {
      const u = await enrollmentsRepository.findUserBrief(e.student_id);
      const rec = byStudent.get(e.student_id);
      return {
        enrollment_id: e.id,
        student_id: e.student_id,
        student: u,
        enrollment_status: e.enrollment_status,
        record: rec
          ? {
              id: rec.id,
              attendance_status: rec.attendance_status,
              notes: rec.notes,
              updated_at: rec.updated_at,
            }
          : null,
      };
    })
  );

  return {
    session_id: sessionId,
    cohort_id: sessionRow.cohort_id,
    cohort_title: cohort.title,
    students,
  };
}

async function saveSessionAttendance(sessionId, body, requester) {
  const { session: sessionRow, cohort } = await assertSessionAttendanceAccess(sessionId, requester);
  const enrollRows = await enrollmentsRepository.findManyByCohort(sessionRow.cohort_id);
  const allowedIds = new Set(
    enrollRows.filter((e) => !['withdrawn', 'cancelled'].includes(e.enrollment_status)).map((e) => e.student_id)
  );

  for (const r of body.records) {
    if (!allowedIds.has(r.student_id)) {
      throw new ApiError(400, `Student ${r.student_id} is not enrolled in this cohort`);
    }
  }

  for (const r of body.records) {
    await attendanceRepository.upsertRecord({
      session_id: sessionId,
      student_id: r.student_id,
      attendance_status: r.attendance_status,
      notes: r.notes ?? null,
    });
  }

  await recalcCohortAttendancePercentages(cohort.id);
  await emitLowAttendanceIfNeeded(cohort.id);
  return getSessionAttendance(sessionId, requester);
}

async function updateAttendanceRecord(recordId, body, requester) {
  const rec = await attendanceRepository.findById(recordId);
  if (!rec) throw new ApiError(404, 'Attendance record not found');
  await assertSessionAttendanceAccess(rec.session_id, requester);

  const data = { updated_at: new Date() };
  if (body.attendance_status !== undefined) data.attendance_status = body.attendance_status;
  if (body.notes !== undefined) data.notes = body.notes;

  await attendanceRepository.updateRecord(recordId, data);
  const sessionRow = await sessionsService.findSessionByIdRaw(rec.session_id);
  if (sessionRow) {
    await recalcCohortAttendancePercentages(sessionRow.cohort_id);
    await emitLowAttendanceIfNeeded(sessionRow.cohort_id);
  }

  const updated = await attendanceRepository.findById(recordId);
  return {
    id: updated.id,
    session_id: updated.session_id,
    student_id: updated.student_id,
    attendance_status: updated.attendance_status,
    notes: updated.notes,
    updated_at: updated.updated_at,
  };
}

async function getCohortAttendanceSummary(cohortId, requester) {
  const cohort = await cohortsRepository.findById(cohortId);
  if (!cohort) throw new ApiError(404, 'Cohort not found');
  if (!canAccessCohort(requester, cohort)) throw new ApiError(403, 'Forbidden');

  const sessionIds = await attendanceRepository.sessionIdsForCohort(cohortId);
  const totalSessions = sessionIds.length;
  const enrollRows = await enrollmentsRepository.findManyByCohort(cohortId);
  const active = enrollRows.filter((e) => !['withdrawn', 'cancelled'].includes(e.enrollment_status));

  const allRecs =
    sessionIds.length === 0
      ? []
      : await prisma.attendance_records.findMany({
          where: { session_id: { in: sessionIds } },
          select: { session_id: true, student_id: true, attendance_status: true },
        });
  const statusByStudentSession = new Map(
    allRecs.map((r) => [`${r.student_id}:${r.session_id}`, r.attendance_status])
  );

  const rows = await Promise.all(
    active.map(async (e) => {
      const u = await enrollmentsRepository.findUserBrief(e.student_id);
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      for (const sid of sessionIds) {
        const st = statusByStudentSession.get(`${e.student_id}:${sid}`);
        if (!st) {
          absent += 1;
          continue;
        }
        if (st === 'present') present += 1;
        else if (st === 'late') late += 1;
        else if (st === 'excused') excused += 1;
        else absent += 1;
      }
      const attended = present + late + excused;
      const attendance_percentage =
        totalSessions > 0 ? Math.round((attended / totalSessions) * 10000) / 100 : Number(e.attendance_percentage ?? 0);
      return {
        enrollment_id: e.id,
        student: u,
        enrollment_status: e.enrollment_status,
        attendance_percentage,
        total_sessions: totalSessions,
        total_present: present,
        total_absent: absent,
        total_late: late,
        total_excused: excused,
      };
    })
  );

  return { cohort_id: cohortId, total_sessions: totalSessions, students: rows };
}

module.exports = {
  getSessionAttendance,
  saveSessionAttendance,
  updateAttendanceRecord,
  getCohortAttendanceSummary,
  recalcCohortAttendancePercentages,
};
