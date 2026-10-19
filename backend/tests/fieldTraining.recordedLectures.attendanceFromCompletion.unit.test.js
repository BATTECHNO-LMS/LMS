'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const mockState = {
  lectures: new Map(),
  sessions: new Map(),
  applications: new Map(),
  attendance: new Map(),
  progress: [],
  audits: [],
  refreshCalls: [],
  eligibilityCalls: [],
};

function key(sessionId, applicationId) {
  return `${sessionId}::${applicationId}`;
}

const fakeTx = {
  field_training_recorded_lectures: {
    async findUnique({ where }) {
      return mockState.lectures.get(where.id) || null;
    },
  },
  field_training_sessions: {
    async findUnique({ where }) {
      return mockState.sessions.get(where.id) || null;
    },
  },
  field_training_applications: {
    async findUnique({ where }) {
      return mockState.applications.get(where.id) || null;
    },
  },
  field_training_attendance: {
    async findUnique({ where }) {
      const k = key(where.session_id_application_id.session_id, where.session_id_application_id.application_id);
      return mockState.attendance.get(k) || null;
    },
    async updateMany({ where, data }) {
      for (const [k, row] of mockState.attendance.entries()) {
        if (where.id && row.id !== where.id) continue;
        if (where.status?.not && row.status === where.status.not) continue;
        mockState.attendance.set(k, { ...row, ...data });
        return { count: 1 };
      }
      return { count: 0 };
    },
    async create({ data }) {
      const k = key(data.session_id, data.application_id);
      if (mockState.attendance.has(k)) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const row = { id: crypto.randomUUID(), ...data };
      mockState.attendance.set(k, row);
      return row;
    },
  },
};

require.cache[require.resolve('../src/config/db')] = {
  id: require.resolve('../src/config/db'),
  filename: require.resolve('../src/config/db'),
  loaded: true,
  exports: {
    prisma: {
      $transaction: async (fn) => fn(fakeTx),
      field_training_recorded_lectures: {
        count: async ({ where } = {}) =>
          [...mockState.lectures.values()].filter((l) =>
            where?.opportunity_id ? l.opportunity_id === where.opportunity_id : true
          ).length,
      },
      field_training_recorded_lecture_progress: {
        count: async () => mockState.progress.length,
        findMany: async ({ where, take } = {}) => {
          let rows = mockState.progress.filter((p) => {
            if (where?.completed_at?.not === null && !p.completed_at) return false;
            return true;
          });
          if (take) rows = rows.slice(0, take);
          return rows.map((p) => ({
            ...p,
            field_training_recorded_lectures: mockState.lectures.get(p.lecture_id) || null,
          }));
        },
      },
      field_training_attendance: {
        findUnique: fakeTx.field_training_attendance.findUnique,
        findMany: async ({ where } = {}) =>
          [...mockState.attendance.values()].filter(
            (a) =>
              (!where?.session_id?.in || where.session_id.in.includes(a.session_id)) &&
              (!where?.application_id?.in || where.application_id.in.includes(a.application_id))
          ),
      },
      field_training_applications: {
        findMany: async ({ where } = {}) =>
          [...mockState.applications.values()].filter(
            (a) => !where?.id?.in || where.id.in.includes(a.id)
          ),
      },
    },
  },
};

require.cache[require.resolve('../src/shared/services/audit.service')] = {
  id: require.resolve('../src/shared/services/audit.service'),
  filename: require.resolve('../src/shared/services/audit.service'),
  loaded: true,
  exports: {
    recordAudit: async (payload) => {
      mockState.audits.push(payload);
      return payload;
    },
  },
};

require.cache[require.resolve('../src/modules/fieldTraining/fieldTraining.workflow')] = {
  id: require.resolve('../src/modules/fieldTraining/fieldTraining.workflow'),
  filename: require.resolve('../src/modules/fieldTraining/fieldTraining.workflow'),
  loaded: true,
  exports: {
    isExpelled: (app) => Boolean(app?.expelled_at),
    refreshAttendancePercentage: async (applicationId) => {
      mockState.refreshCalls.push(applicationId);
    },
    persistEligibility: async (applicationId) => {
      mockState.eligibilityCalls.push(applicationId);
    },
  },
};

delete require.cache[
  require.resolve('../src/modules/fieldTraining/fieldTraining.recordedLectures.attendanceFromCompletion.service')
];
const {
  markLinkedSessionPresentFromRecordedLecture,
  reconcileRecordedLectureAttendance,
  SOURCE,
  AUDIT_ACTION,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.attendanceFromCompletion.service');

function seed({ status = null, sessionLinked = true, completed = true } = {}) {
  const lectureId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const otherSessionId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const opportunityId = crypto.randomUUID();

  mockState.lectures.set(lectureId, {
    id: lectureId,
    session_id: sessionLinked ? sessionId : null,
    opportunity_id: opportunityId,
    title: 'Lecture A',
  });
  mockState.sessions.set(sessionId, {
    id: sessionId,
    opportunity_id: opportunityId,
    title: 'Session 15',
  });
  mockState.sessions.set(otherSessionId, {
    id: otherSessionId,
    opportunity_id: opportunityId,
    title: 'Session 16',
  });
  mockState.applications.set(applicationId, {
    id: applicationId,
    student_id: studentId,
    opportunity_id: opportunityId,
    status: 'approved',
    training_status: 'in_training',
    expelled_at: null,
  });
  if (status) {
    mockState.attendance.set(key(sessionId, applicationId), {
      id: crypto.randomUUID(),
      session_id: sessionId,
      application_id: applicationId,
      student_id: studentId,
      status,
      method: status === 'absent' ? 'manual' : 'auto_finalize',
      confirmed_at: null,
    });
  }
  mockState.progress.push({
    id: crypto.randomUUID(),
    lecture_id: lectureId,
    application_id: applicationId,
    student_id: studentId,
    completed_at: completed ? new Date('2026-10-18T14:25:00.000Z') : null,
  });
  return { lectureId, sessionId, otherSessionId, applicationId, studentId, opportunityId };
}

beforeEach(() => {
  mockState.lectures.clear();
  mockState.sessions.clear();
  mockState.applications.clear();
  mockState.attendance.clear();
  mockState.progress = [];
  mockState.audits.length = 0;
  mockState.refreshCalls.length = 0;
  mockState.eligibilityCalls.length = 0;
});

describe('recorded lecture → linked session PRESENT', () => {
  for (const status of ['absent', 'late', 'excused', 'unconfirmed']) {
    it(`${status} → present`, async () => {
      const ctx = seed({ status });
      const result = await markLinkedSessionPresentFromRecordedLecture({
        lectureId: ctx.lectureId,
        applicationId: ctx.applicationId,
        studentId: ctx.studentId,
        completedAt: new Date('2026-10-18T14:25:00.000Z'),
      });
      assert.equal(result.changed, true);
      assert.equal(result.oldStatus, status);
      const row = mockState.attendance.get(key(ctx.sessionId, ctx.applicationId));
      assert.equal(row.status, 'present');
      assert.equal(row.note, SOURCE);
      assert.equal(mockState.audits.length, 1);
      assert.equal(mockState.audits[0].actionType, AUDIT_ACTION);
      assert.equal(mockState.audits[0].oldValues.status, status);
      assert.equal(mockState.audits[0].newValues.status, 'present');
      assert.equal(mockState.audits[0].newValues.source, SOURCE);
      assert.equal(mockState.refreshCalls.length, 1);
      assert.equal(mockState.eligibilityCalls.length, 1);
    });
  }

  it('manual absent → present (method does not block)', async () => {
    const ctx = seed({ status: 'absent' });
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(result.changed, true);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
  });

  it('finalized/auto_finalize absent → present', async () => {
    const ctx = seed({ status: 'absent' });
    const existing = mockState.attendance.get(key(ctx.sessionId, ctx.applicationId));
    existing.method = 'auto_finalize';
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(result.changed, true);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
  });

  it('missing attendance → create present', async () => {
    const ctx = seed({ status: null });
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(result.created, true);
    assert.equal(result.changed, true);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
    assert.equal(mockState.audits.length, 1);
  });

  it('already present is idempotent (no audit / no recalc)', async () => {
    const ctx = seed({ status: 'present' });
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(result.changed, false);
    assert.equal(result.skipped, 'ALREADY_PRESENT');
    assert.equal(mockState.audits.length, 0);
    assert.equal(mockState.refreshCalls.length, 0);
    assert.equal(mockState.eligibilityCalls.length, 0);
  });

  it('repeated completion processing audits once', async () => {
    const ctx = seed({ status: 'absent' });
    await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(mockState.audits.length, 1);
    assert.equal(mockState.attendance.size, 1);
  });

  it('unlinked lecture skips attendance', async () => {
    const ctx = seed({ sessionLinked: false, status: 'absent' });
    const before = mockState.attendance.get(key(ctx.sessionId, ctx.applicationId));
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(result.skipped, 'NO_LINKED_SESSION');
    assert.equal(before.status, 'absent');
    assert.equal(mockState.audits.length, 0);
  });

  it('wrong student does not change attendance', async () => {
    const ctx = seed({ status: 'absent' });
    const result = await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: crypto.randomUUID(),
      completedAt: new Date(),
    });
    assert.equal(result.skipped, 'APPLICATION_INVALID');
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'absent');
  });

  it('only linked session is updated', async () => {
    const ctx = seed({ status: 'absent' });
    mockState.attendance.set(key(ctx.otherSessionId, ctx.applicationId), {
      id: crypto.randomUUID(),
      session_id: ctx.otherSessionId,
      application_id: ctx.applicationId,
      student_id: ctx.studentId,
      status: 'absent',
    });
    await markLinkedSessionPresentFromRecordedLecture({
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    });
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
    assert.equal(mockState.attendance.get(key(ctx.otherSessionId, ctx.applicationId)).status, 'absent');
  });

  it('concurrent upserts do not create duplicate rows', async () => {
    const ctx = seed({ status: null });
    const input = {
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    };
    await Promise.all([
      markLinkedSessionPresentFromRecordedLecture(input),
      markLinkedSessionPresentFromRecordedLecture(input),
    ]);
    assert.equal(mockState.attendance.size, 1);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
    // Second create hits unique constraint (P2002) → already-present short-circuit; one audit.
    assert.equal(mockState.audits.length, 1);
  });

  it('concurrent status flips emit a single audit', async () => {
    const ctx = seed({ status: 'absent' });
    const input = {
      lectureId: ctx.lectureId,
      applicationId: ctx.applicationId,
      studentId: ctx.studentId,
      completedAt: new Date(),
    };
    await Promise.all([
      markLinkedSessionPresentFromRecordedLecture(input),
      markLinkedSessionPresentFromRecordedLecture(input),
    ]);
    assert.equal(mockState.attendance.size, 1);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
    assert.equal(mockState.audits.length, 1);
    assert.equal(mockState.refreshCalls.length, 1);
  });
});

describe('recorded lecture attendance reconciliation', () => {
  for (const status of ['absent', 'late', 'excused', 'unconfirmed']) {
    it(`dry-run then apply: completed + ${status} → present`, async () => {
      const ctx = seed({ status });
      const dry = await reconcileRecordedLectureAttendance({ apply: false });
      assert.equal(dry.mode, 'DRY_RUN');
      assert.equal(dry.completedStudents, 1);
      assert.equal(dry.actionable, 1);
      assert.equal(dry.convertedToPresent, 0);

      const applied = await reconcileRecordedLectureAttendance({ apply: true });
      assert.equal(applied.mode, 'APPLY');
      assert.equal(applied.convertedToPresent, 1);
      assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
      assert.equal(mockState.audits.length, 1);
      assert.equal(mockState.audits[0].newValues.reconciliation, true);
      assert.equal(mockState.audits[0].newValues.oldStatus, status);
    });
  }

  it('apply creates missing attendance as present', async () => {
    const ctx = seed({ status: null });
    const applied = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(applied.missingAttendanceCreated, 1);
    assert.equal(applied.convertedToPresent, 1);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
  });

  it('already present is no-op on apply', async () => {
    seed({ status: 'present' });
    const applied = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(applied.actionable, 0);
    assert.equal(applied.convertedToPresent, 0);
    assert.equal(applied.alreadyPresent, 1);
    assert.equal(mockState.audits.length, 0);
  });

  it('incomplete progress is not touched', async () => {
    const ctx = seed({ status: 'absent', completed: false });
    const applied = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(applied.completedStudents, 0);
    assert.equal(applied.convertedToPresent, 0);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'absent');
  });

  it('no linked session does not mutate attendance', async () => {
    const ctx = seed({ status: 'absent', sessionLinked: false });
    const applied = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(applied.noLinkedSession, 1);
    assert.equal(applied.convertedToPresent, 0);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'absent');
  });

  it('second apply run is idempotent no-op', async () => {
    seed({ status: 'absent' });
    const first = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(first.convertedToPresent, 1);
    mockState.audits.length = 0;
    mockState.refreshCalls.length = 0;
    const second = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(second.actionable, 0);
    assert.equal(second.convertedToPresent, 0);
    assert.equal(second.alreadyPresent, 1);
    assert.equal(mockState.audits.length, 0);
    assert.equal(mockState.refreshCalls.length, 0);
  });

  it('finalized auto_finalize absent → present via reconcile', async () => {
    const ctx = seed({ status: 'absent' });
    const existing = mockState.attendance.get(key(ctx.sessionId, ctx.applicationId));
    existing.method = 'auto_finalize';
    const applied = await reconcileRecordedLectureAttendance({ apply: true });
    assert.equal(applied.convertedToPresent, 1);
    assert.equal(mockState.attendance.get(key(ctx.sessionId, ctx.applicationId)).status, 'present');
  });
});
