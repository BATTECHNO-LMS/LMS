'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const state = {
  lecture: null,
  apps: [],
  profiles: [],
  progress: [],
  attendance: [],
  accessDenied: false,
};

require.cache[require.resolve('../src/config/db')] = {
  id: require.resolve('../src/config/db'),
  filename: require.resolve('../src/config/db'),
  loaded: true,
  exports: {
    prisma: {
      field_training_recorded_lecture_progress: {
        findMany: async ({ where }) =>
          state.progress.filter(
            (p) =>
              p.lecture_id === where.lecture_id &&
              where.application_id.in.includes(p.application_id)
          ),
      },
      field_training_attendance: {
        findMany: async ({ where }) =>
          state.attendance.filter(
            (a) =>
              a.session_id === where.session_id &&
              where.application_id.in.includes(a.application_id)
          ),
      },
      field_training_sessions: {
        findUnique: async () => null,
      },
    },
  },
};

require.cache[require.resolve('../src/modules/fieldTraining/fieldTraining.repository')] = {
  id: require.resolve('../src/modules/fieldTraining/fieldTraining.repository'),
  filename: require.resolve('../src/modules/fieldTraining/fieldTraining.repository'),
  loaded: true,
  exports: {
    findEligibleAttendanceParticipants: async () => state.apps,
    findStudentProfilesByIds: async () => state.profiles,
  },
};

require.cache[require.resolve('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository')] = {
  id: require.resolve('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository'),
  filename: require.resolve('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository'),
  loaded: true,
  exports: {
    findById: async () => state.lecture,
    mapLectureRow: (row) => ({
      id: row.id,
      title: row.title,
      status: 'PUBLISHED',
      session_id: row.session_id,
    }),
  },
};

require.cache[require.resolve('../src/modules/fieldTraining/fieldTraining.access')] = {
  id: require.resolve('../src/modules/fieldTraining/fieldTraining.access'),
  filename: require.resolve('../src/modules/fieldTraining/fieldTraining.access'),
  loaded: true,
  exports: {
    assertRecordedLectureReadAccess: async () => {
      if (state.accessDenied) {
        const err = new Error('FORBIDDEN');
        err.statusCode = 403;
        throw err;
      }
      return { readOnly: false };
    },
  },
};

delete require.cache[
  require.resolve('../src/modules/fieldTraining/fieldTraining.recordedLectures.progressRoster.service')
];
const {
  listLectureStudentProgress,
  buildSummary,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.progressRoster.service');

function seedRoster() {
  const opportunityId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const lectureId = crypto.randomUUID();
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  const c = crypto.randomUUID();
  const d = crypto.randomUUID();
  const appA = crypto.randomUUID();
  const appB = crypto.randomUUID();
  const appC = crypto.randomUUID();
  const appD = crypto.randomUUID();

  state.lecture = {
    id: lectureId,
    title: 'Lecture A',
    opportunity_id: opportunityId,
    session_id: sessionId,
    duration_seconds: 1000,
    field_training_sessions: {
      id: sessionId,
      title: 'Session 15',
      session_date: new Date('2026-10-18'),
    },
    field_training_opportunities: {
      id: opportunityId,
      university_id: crypto.randomUUID(),
    },
  };
  state.apps = [
    { id: appA, student_id: a, opportunity_id: opportunityId },
    { id: appB, student_id: b, opportunity_id: opportunityId },
    { id: appC, student_id: c, opportunity_id: opportunityId },
    { id: appD, student_id: d, opportunity_id: opportunityId },
  ];
  state.profiles = [
    { id: a, full_name: 'Student A', university_student_number: '1001' },
    { id: b, full_name: 'Student B', university_student_number: '1002' },
    { id: c, full_name: 'Student C', university_student_number: '1003' },
    { id: d, full_name: 'Student D', university_student_number: '1004' },
  ];
  state.progress = [
    {
      application_id: appA,
      student_id: a,
      lecture_id: lectureId,
      unique_watched_seconds: 1000,
      total_playback_seconds: 1000,
      last_position_seconds: 1000,
      progress_percentage: 100,
      started_at: new Date(),
      last_watched_at: new Date(),
      completed_at: new Date('2026-10-18T02:15:00.000Z'),
      video_duration_seconds: 1000,
      updated_at: new Date(),
    },
    {
      application_id: appB,
      student_id: b,
      lecture_id: lectureId,
      unique_watched_seconds: 750,
      total_playback_seconds: 800,
      last_position_seconds: 750,
      progress_percentage: 75,
      started_at: new Date(),
      last_watched_at: new Date(),
      completed_at: null,
      video_duration_seconds: 1000,
      updated_at: new Date(),
    },
    {
      application_id: appC,
      student_id: c,
      lecture_id: lectureId,
      unique_watched_seconds: 0,
      total_playback_seconds: 0,
      last_position_seconds: 0,
      progress_percentage: 0,
      started_at: null,
      last_watched_at: null,
      completed_at: null,
      video_duration_seconds: 1000,
      updated_at: new Date(),
    },
  ];
  state.attendance = [
    { application_id: appA, session_id: sessionId, status: 'present' },
    { application_id: appB, session_id: sessionId, status: 'absent' },
  ];
  return { lectureId, a, b, c, d };
}

beforeEach(() => {
  state.lecture = null;
  state.apps = [];
  state.profiles = [];
  state.progress = [];
  state.attendance = [];
  state.accessDenied = false;
});

describe('recorded lecture progress roster', () => {
  it('includes all eligible students including those with no progress row', async () => {
    const ctx = seedRoster();
    const data = await listLectureStudentProgress(ctx.lectureId, { isGlobal: true }, {});
    assert.equal(data.summary.totalStudents, 4);
    assert.equal(data.summary.completed, 1);
    assert.equal(data.summary.inProgress, 1);
    assert.equal(data.summary.notStarted, 2);
    assert.equal(data.summary.averageProgress, 43.8);

    const byName = Object.fromEntries(data.students.map((s) => [s.name, s]));
    assert.equal(byName['Student A'].completionStatus, 'completed');
    assert.equal(byName['Student A'].progressPercent, 100);
    assert.equal(byName['Student A'].attendanceStatus, 'present');
    assert.ok(byName['Student A'].completedAt);

    assert.equal(byName['Student B'].completionStatus, 'in_progress');
    assert.equal(byName['Student B'].progressPercent, 75);

    assert.equal(byName['Student C'].completionStatus, 'not_started');
    assert.equal(byName['Student C'].progressPercent, 0);

    assert.equal(byName['Student D'].completionStatus, 'not_started');
    assert.equal(byName['Student D'].progressPercent, 0);
    assert.equal(byName['Student D'].attendanceStatus, null);
  });

  it('buildSummary matches fixture math', () => {
    const summary = buildSummary(
      [
        { progressPercent: 100, completionStatus: 'completed', attendanceStatus: 'present', needsSync: false },
        { progressPercent: 75, completionStatus: 'in_progress', attendanceStatus: 'absent', needsSync: false },
        { progressPercent: 0, completionStatus: 'not_started', attendanceStatus: null, needsSync: false },
        { progressPercent: 0, completionStatus: 'not_started', attendanceStatus: null, needsSync: false },
      ],
      true
    );
    assert.equal(summary.totalStudents, 4);
    assert.equal(summary.completed, 1);
    assert.equal(summary.inProgress, 1);
    assert.equal(summary.notStarted, 2);
    assert.equal(summary.averageProgress, 43.8);
    assert.equal(summary.linkedSessionPresent, 1);
  });

  it('denies cross-tenant access', async () => {
    seedRoster();
    state.accessDenied = true;
    await assert.rejects(
      () => listLectureStudentProgress(state.lecture.id, { universityId: 'other' }, {}),
      /FORBIDDEN/
    );
  });

  it('filters completed students and paginates', async () => {
    const ctx = seedRoster();
    const data = await listLectureStudentProgress(
      ctx.lectureId,
      { isGlobal: true },
      { filter: 'completed', page: 1, page_size: 25 }
    );
    assert.equal(data.students.length, 1);
    assert.equal(data.students[0].name, 'Student A');
    assert.equal(data.summary.totalStudents, 4);
  });

  it('flags needsSync when completed but attendance is not present', async () => {
    const ctx = seedRoster();
    const appA = state.apps[0].id;
    state.attendance = state.attendance.filter((a) => a.application_id !== appA);
    state.attendance.push({
      application_id: appA,
      session_id: state.lecture.session_id,
      status: 'absent',
    });
    const data = await listLectureStudentProgress(ctx.lectureId, { isGlobal: true }, {
      filter: 'needs_sync',
    });
    assert.equal(data.summary.needsSync, 1);
    assert.equal(data.students.length, 1);
    assert.equal(data.students[0].needsSync, true);
    assert.equal(data.students[0].attendanceStatus, 'absent');
  });
});
