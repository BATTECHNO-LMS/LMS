'use strict';

/**
 * When a student reaches canonical Recorded Lecture completion and the lecture is linked
 * to a Field Training session, mark that student's attendance PRESENT for that session.
 *
 * One-way rule: completion → PRESENT (never auto-reverts).
 * Previous status (including manual/finalized absent) does not block the transition.
 *
 * Also provides historical dry-run / apply reconciliation over existing completed progress.
 */

const { prisma } = require('../../config/db');
const { recordAudit } = require('../../shared/services/audit.service');
const workflow = require('./fieldTraining.workflow');
const { isExpelled } = require('./fieldTraining.workflow');

const SOURCE = 'RECORDED_LECTURE_COMPLETION';
const AUDIT_ACTION = 'ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE';
const REASON_NOTE =
  'Automatically marked present after completing linked Recorded Lecture';

/**
 * Upsert PRESENT inside an existing Prisma transaction.
 * @returns {{ skipped?: string, changed?: boolean, created?: boolean, oldStatus?: string|null, attendanceId?: string, sessionId?: string, lectureTitle?: string|null, sessionTitle?: string|null }}
 */
async function upsertPresentInTx(tx, {
  lectureId,
  applicationId,
  studentId,
  completedAt,
}) {
  const lecture = await tx.field_training_recorded_lectures.findUnique({
    where: { id: lectureId },
    select: {
      id: true,
      session_id: true,
      opportunity_id: true,
      title: true,
    },
  });
  if (!lecture) return { skipped: 'LECTURE_NOT_FOUND' };
  if (!lecture.session_id) return { skipped: 'NO_LINKED_SESSION' };

  const session = await tx.field_training_sessions.findUnique({
    where: { id: lecture.session_id },
    select: { id: true, opportunity_id: true, title: true },
  });
  if (!session || String(session.opportunity_id) !== String(lecture.opportunity_id)) {
    return { skipped: 'SESSION_MISMATCH' };
  }

  const app = await tx.field_training_applications.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      student_id: true,
      opportunity_id: true,
      status: true,
      training_status: true,
      expelled_at: true,
    },
  });
  if (
    !app ||
    String(app.student_id) !== String(studentId) ||
    String(app.opportunity_id) !== String(lecture.opportunity_id) ||
    app.status !== 'approved' ||
    isExpelled(app)
  ) {
    return { skipped: 'APPLICATION_INVALID' };
  }

  const existing = await tx.field_training_attendance.findUnique({
    where: {
      session_id_application_id: {
        session_id: session.id,
        application_id: app.id,
      },
    },
  });

  if (existing && existing.status === 'present') {
    return {
      skipped: 'ALREADY_PRESENT',
      changed: false,
      created: false,
      oldStatus: 'present',
      attendanceId: existing.id,
      sessionId: session.id,
      lectureTitle: lecture.title,
      sessionTitle: session.title,
    };
  }

  const now = completedAt instanceof Date ? completedAt : new Date(completedAt || Date.now());
  const oldStatus = existing?.status ?? null;
  const presentFields = {
    status: 'present',
    note: SOURCE,
    manual_reason: REASON_NOTE,
    recorded_by_id: studentId,
    recorded_at: now,
    updated_at: now,
  };

  // Conditional update wins the race: only one concurrent TX flips status → present.
  if (existing) {
    const updated = await tx.field_training_attendance.updateMany({
      where: {
        id: existing.id,
        status: { not: 'present' },
      },
      data: {
        ...presentFields,
        confirmed_at: existing.confirmed_at || now,
      },
    });
    if (updated.count === 0) {
      return {
        skipped: 'ALREADY_PRESENT',
        changed: false,
        created: false,
        oldStatus: 'present',
        attendanceId: existing.id,
        sessionId: session.id,
        lectureTitle: lecture.title,
        sessionTitle: session.title,
      };
    }
    return {
      changed: true,
      created: false,
      oldStatus,
      attendanceId: existing.id,
      sessionId: session.id,
      lectureId: lecture.id,
      lectureTitle: lecture.title,
      sessionTitle: session.title,
      applicationId: app.id,
      studentId,
    };
  }

  let row;
  try {
    row = await tx.field_training_attendance.create({
      data: {
        session_id: session.id,
        application_id: app.id,
        student_id: studentId,
        ...presentFields,
        method: null,
        confirmed_at: now,
      },
    });
  } catch (err) {
    if (err?.code !== 'P2002') throw err;
    return {
      skipped: 'ALREADY_PRESENT',
      changed: false,
      created: false,
      oldStatus: 'present',
      sessionId: session.id,
      lectureTitle: lecture.title,
      sessionTitle: session.title,
    };
  }

  return {
    changed: true,
    created: true,
    oldStatus: null,
    attendanceId: row.id,
    sessionId: session.id,
    lectureId: lecture.id,
    lectureTitle: lecture.title,
    sessionTitle: session.title,
    applicationId: app.id,
    studentId,
  };
}

/**
 * Post-commit audit + eligibility refresh when attendance actually changed.
 */
async function finalizeAttendanceSideEffects(sideEffect, { reconciliation = false } = {}) {
  if (!sideEffect?.changed || !sideEffect.attendanceId) {
    return { audited: false, recalculated: false };
  }

  await recordAudit({
    userId: sideEffect.studentId,
    subjectUserId: sideEffect.studentId,
    actionType: AUDIT_ACTION,
    entityType: 'field_training_attendance',
    entityId: sideEffect.attendanceId,
    oldValues: sideEffect.oldStatus
      ? { status: sideEffect.oldStatus }
      : null,
    newValues: {
      status: 'present',
      source: SOURCE,
      lectureId: sideEffect.lectureId,
      sessionId: sideEffect.sessionId,
      lectureTitle: sideEffect.lectureTitle,
      sessionTitle: sideEffect.sessionTitle,
      oldStatus: sideEffect.oldStatus,
      completedAt: sideEffect.completedAt || null,
      created: Boolean(sideEffect.created),
      reconciliation: Boolean(reconciliation),
    },
  });

  await workflow.refreshAttendancePercentage(sideEffect.applicationId);
  await workflow.persistEligibility(sideEffect.applicationId);

  return { audited: true, recalculated: true };
}

/**
 * Standalone entry (outside heartbeat TX) for repair/tests/reconciliation.
 */
async function markLinkedSessionPresentFromRecordedLecture(input, options = {}) {
  const sideEffect = await prisma.$transaction(async (tx) =>
    upsertPresentInTx(tx, input)
  );
  if (sideEffect.changed) {
    sideEffect.completedAt = input.completedAt || new Date();
    await finalizeAttendanceSideEffects(sideEffect, options);
  }
  return sideEffect;
}

function emptyScanTotals() {
  return {
    lecturesScanned: 0,
    progressRecordsScanned: 0,
    completedStudents: 0,
    alreadyPresent: 0,
    needAttendanceUpdate: 0,
    missingAttendanceRows: 0,
    noLinkedSession: 0,
    invalidOrphaned: 0,
    errors: 0,
  };
}

/**
 * Dry-run / inventory scan over completed recorded-lecture progress.
 * Never writes. Uses batched attendance lookup (no N+1).
 */
async function scanRecordedLectureAttendance({ opportunityId, limit = 5000 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 5000, 1), 20000);
  const lectureWhere = opportunityId ? { opportunity_id: opportunityId } : {};

  const [lecturesScanned, progressRecordsScanned, completedRows] = await Promise.all([
    prisma.field_training_recorded_lectures.count({ where: lectureWhere }),
    prisma.field_training_recorded_lecture_progress.count({
      where: {
        field_training_recorded_lectures: lectureWhere,
      },
    }),
    prisma.field_training_recorded_lecture_progress.findMany({
      where: {
        completed_at: { not: null },
        field_training_recorded_lectures: lectureWhere,
      },
      take,
      orderBy: { completed_at: 'desc' },
      select: {
        id: true,
        lecture_id: true,
        application_id: true,
        student_id: true,
        completed_at: true,
        field_training_recorded_lectures: {
          select: {
            id: true,
            title: true,
            session_id: true,
            opportunity_id: true,
          },
        },
      },
    }),
  ]);

  const totals = emptyScanTotals();
  totals.lecturesScanned = lecturesScanned;
  totals.progressRecordsScanned = progressRecordsScanned;
  totals.completedStudents = completedRows.length;

  const withSession = [];
  const byLecture = new Map();

  function lectureBucket(lecture) {
    const id = lecture?.id || 'unknown';
    if (!byLecture.has(id)) {
      byLecture.set(id, {
        lectureId: lecture?.id || null,
        lectureTitle: lecture?.title || null,
        sessionId: lecture?.session_id || null,
        completed: 0,
        alreadyPresent: 0,
        needUpdate: 0,
        missingAttendance: 0,
        noLinkedSession: 0,
        invalidOrphaned: 0,
      });
    }
    return byLecture.get(id);
  }

  for (const row of completedRows) {
    const lecture = row.field_training_recorded_lectures;
    const bucket = lectureBucket(lecture);
    bucket.completed += 1;
    if (!lecture?.session_id) {
      totals.noLinkedSession += 1;
      bucket.noLinkedSession += 1;
      continue;
    }
    withSession.push(row);
  }

  const sessionIds = [...new Set(withSession.map((r) => r.field_training_recorded_lectures.session_id))];
  const applicationIds = [...new Set(withSession.map((r) => r.application_id))];

  const attendanceRows =
    sessionIds.length && applicationIds.length
      ? await prisma.field_training_attendance.findMany({
          where: {
            session_id: { in: sessionIds },
            application_id: { in: applicationIds },
          },
          select: { id: true, session_id: true, application_id: true, status: true },
        })
      : [];

  const attendanceMap = new Map(
    attendanceRows.map((a) => [`${a.session_id}::${a.application_id}`, a])
  );

  const apps =
    applicationIds.length
      ? await prisma.field_training_applications.findMany({
          where: { id: { in: applicationIds } },
          select: {
            id: true,
            student_id: true,
            opportunity_id: true,
            status: true,
            training_status: true,
            expelled_at: true,
          },
        })
      : [];
  const appMap = new Map(apps.map((a) => [a.id, a]));

  const needUpdate = [];
  const missing = [];
  const alreadyPresent = [];
  const invalid = [];

  for (const row of withSession) {
    const lecture = row.field_training_recorded_lectures;
    const bucket = lectureBucket(lecture);
    const sessionId = lecture.session_id;
    const app = appMap.get(row.application_id);
    if (
      !app ||
      String(app.student_id) !== String(row.student_id) ||
      String(app.opportunity_id) !== String(lecture.opportunity_id) ||
      app.status !== 'approved' ||
      isExpelled(app)
    ) {
      totals.invalidOrphaned += 1;
      bucket.invalidOrphaned += 1;
      invalid.push({
        studentId: row.student_id,
        applicationId: row.application_id,
        lectureId: row.lecture_id,
        lectureTitle: lecture.title,
        sessionId,
        reason: 'APPLICATION_INVALID',
        completedAt: row.completed_at,
      });
      continue;
    }

    const att = attendanceMap.get(`${sessionId}::${row.application_id}`);
    const item = {
      studentId: row.student_id,
      applicationId: row.application_id,
      lectureId: row.lecture_id,
      lectureTitle: lecture.title,
      sessionId,
      currentAttendance: att?.status ?? null,
      expectedAttendance: 'present',
      completedAt: row.completed_at,
    };

    if (att?.status === 'present') {
      totals.alreadyPresent += 1;
      bucket.alreadyPresent += 1;
      alreadyPresent.push(item);
    } else if (!att) {
      totals.missingAttendanceRows += 1;
      bucket.missingAttendance += 1;
      missing.push(item);
      needUpdate.push(item);
    } else {
      totals.needAttendanceUpdate += 1;
      bucket.needUpdate += 1;
      needUpdate.push(item);
    }
  }

  // needAttendanceUpdate in totals counts status≠present; missing is separate.
  // Spec also wants "Need attendance update" to cover both — keep both counters distinct.
  totals.needAttendanceUpdate = needUpdate.filter((r) => r.currentAttendance != null).length;

  return {
    totals: {
      ...totals,
      actionable: needUpdate.length,
    },
    byLecture: [...byLecture.values()],
    rows: {
      needUpdate,
      missing,
      alreadyPresent,
      invalid,
    },
  };
}

/**
 * @deprecated Prefer scanRecordedLectureAttendance().rows.needUpdate
 */
async function listCompletedLecturesWithNonPresentLinkedAttendance(opts = {}) {
  const scan = await scanRecordedLectureAttendance(opts);
  return scan.rows.needUpdate;
}

/**
 * Reconcile completed linked lectures → PRESENT.
 * Default dry-run. Pass apply:true for writes.
 */
async function reconcileRecordedLectureAttendance({
  opportunityId,
  apply = false,
  limit = 5000,
  batchSize = 40,
} = {}) {
  const scan = await scanRecordedLectureAttendance({ opportunityId, limit });
  const report = {
    mode: apply ? 'APPLY' : 'DRY_RUN',
    ...scan.totals,
    byLecture: scan.byLecture,
    convertedToPresent: 0,
    missingAttendanceCreated: 0,
    unchanged: scan.totals.alreadyPresent,
    skippedInvalid: scan.totals.invalidOrphaned,
    errors: [],
    changedRows: [],
  };

  if (!apply) {
    report.preview = scan.rows.needUpdate.slice(0, 200);
    return report;
  }

  const actionable = scan.rows.needUpdate;
  const size = Math.min(Math.max(Number(batchSize) || 40, 1), 200);

  for (let i = 0; i < actionable.length; i += size) {
    const batch = actionable.slice(i, i + size);
    for (const item of batch) {
      try {
        const result = await markLinkedSessionPresentFromRecordedLecture(
          {
            lectureId: item.lectureId,
            applicationId: item.applicationId,
            studentId: item.studentId,
            completedAt: item.completedAt,
          },
          { reconciliation: true }
        );
        if (result.changed) {
          report.convertedToPresent += 1;
          if (result.created) report.missingAttendanceCreated += 1;
          report.changedRows.push({
            ...item,
            oldStatus: result.oldStatus,
            newStatus: 'present',
            created: Boolean(result.created),
          });
        }
      } catch (err) {
        report.errors.push({
          lectureId: item.lectureId,
          applicationId: item.applicationId,
          studentId: item.studentId,
          message: err?.message || String(err),
        });
      }
    }
  }

  report.errorsCount = report.errors.length;
  return report;
}

module.exports = {
  SOURCE,
  AUDIT_ACTION,
  REASON_NOTE,
  upsertPresentInTx,
  finalizeAttendanceSideEffects,
  markLinkedSessionPresentFromRecordedLecture,
  listCompletedLecturesWithNonPresentLinkedAttendance,
  scanRecordedLectureAttendance,
  reconcileRecordedLectureAttendance,
};
