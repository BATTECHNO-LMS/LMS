'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../src/utils/apiError');
const {
  createService,
  nextSortOrder,
  normalizeStatus,
  mapDuplicateError,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.service');
const lectureMappers = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.repository');
const provider = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.provider');
const { canManageFieldTraining } = require('../src/modules/fieldTraining/fieldTraining.access');

const ROOT = path.join(__dirname, '..');
const ZARQA_UNI = '4b85f423-c543-499e-9765-a5248dbfa583';
const TAFILA_UNI = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZARQA_OPP = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const VIDEO_ID = 'dQw4w9WgXcQ';
const ZARQA_SESSION = '11111111-1111-4111-8111-111111111111';
const TAFILA_SESSION = '22222222-2222-4222-8222-222222222222';
const STUDENT_ZARQA = '33333333-3333-4333-8333-333333333333';
const STUDENT_OTHER = '44444444-4444-4444-8444-444444444444';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function user({ roles, universityId, isGlobal = false, organizationType = 'UNIVERSITY', userId }) {
  return {
    userId: userId || crypto.randomUUID(),
    roles,
    universityId,
    isGlobal,
    organizationType,
    portalType: organizationType,
  };
}

function makeStore() {
  return {
    opportunities: [
      {
        id: ZARQA_OPP,
        title: 'Zarqa FT',
        university_id: ZARQA_UNI,
        assigned_instructor_id: null,
        status: 'published',
      },
      {
        id: TAFILA_OPP,
        title: 'Tafila FT',
        university_id: TAFILA_UNI,
        assigned_instructor_id: null,
        status: 'published',
      },
    ],
    sessions: [
      { id: ZARQA_SESSION, opportunity_id: ZARQA_OPP, title: 'المحاضرة الخامسة' },
      { id: TAFILA_SESSION, opportunity_id: TAFILA_OPP, title: 'جلسة الطفيلة' },
    ],
    applications: [
      {
        id: crypto.randomUUID(),
        opportunity_id: ZARQA_OPP,
        student_id: STUDENT_ZARQA,
        status: 'approved',
        training_status: 'in_training',
        expelled_at: null,
      },
    ],
    lectures: [],
  };
}

function createHarness(store = makeStore()) {
  const lectureRepo = {
    mapLectureRow: lectureMappers.mapLectureRow,
    mapStudentLectureRow: lectureMappers.mapStudentLectureRow,
    async listByOpportunity(opportunityId, { status } = {}) {
      return store.lectures
        .filter((row) => row.opportunity_id === opportunityId && (!status || row.status === status))
        .sort((a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)));
    },
    async findById(id) {
      const row = store.lectures.find((item) => item.id === id);
      if (!row) return null;
      return {
        ...row,
        field_training_opportunities: store.opportunities.find((o) => o.id === row.opportunity_id),
        field_training_sessions: store.sessions.find((s) => s.id === row.session_id) || null,
      };
    },
    async findMaxSortOrder(opportunityId) {
      const rows = store.lectures.filter((row) => row.opportunity_id === opportunityId);
      if (!rows.length) return null;
      return Math.max(...rows.map((row) => row.sort_order));
    },
    async createLecture(data) {
      const dup = store.lectures.find(
        (row) =>
          row.opportunity_id === data.opportunity_id &&
          row.provider === data.provider &&
          row.provider_video_id === data.provider_video_id
      );
      if (dup) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['opportunity_id', 'provider', 'provider_video_id'] };
        throw err;
      }
      const row = {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        ...data,
        field_training_sessions: store.sessions.find((s) => s.id === data.session_id) || null,
      };
      store.lectures.push(row);
      return row;
    },
    async updateLecture(id, data) {
      const idx = store.lectures.findIndex((row) => row.id === id);
      if (idx < 0) {
        const err = new Error('not found');
        err.code = 'P2025';
        throw err;
      }
      const next = { ...store.lectures[idx], ...data, updated_at: new Date() };
      const dup = store.lectures.find(
        (row) =>
          row.id !== id &&
          row.opportunity_id === next.opportunity_id &&
          row.provider === next.provider &&
          row.provider_video_id === next.provider_video_id
      );
      if (dup) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        err.meta = { target: ['opportunity_id', 'provider', 'provider_video_id'] };
        throw err;
      }
      store.lectures[idx] = next;
      return {
        ...next,
        field_training_sessions: store.sessions.find((s) => s.id === next.session_id) || null,
      };
    },
  };

  const ftRepo = {
    async findById(id) {
      return store.opportunities.find((row) => row.id === id) || null;
    },
    async findPublishedById(id) {
      const row = store.opportunities.find((item) => item.id === id);
      if (!row || !['published', 'in_progress'].includes(row.status)) return null;
      return row;
    },
    async findSessionById(id) {
      return store.sessions.find((row) => row.id === id) || null;
    },
    async findApplicationByOpportunityAndStudent(opportunityId, studentId) {
      return (
        store.applications.find(
          (row) => row.opportunity_id === opportunityId && row.student_id === studentId
        ) || null
      );
    },
  };

  const audits = [];
  const service = createService({
    lectureRepo,
    ftRepo,
    recordAudit: async (payload) => {
      audits.push(payload);
    },
    assertStudentCanAccessOpportunity: async (opportunity, studentId) => {
      if (studentId === STUDENT_ZARQA && opportunity.id === ZARQA_OPP) return;
      throw new ApiError(403, 'هذه الفرصة غير متاحة للجامعة أو التخصص المسجل في حسابك.', null, 'FIELD_TRAINING_NOT_ELIGIBLE');
    },
  });

  return { store, service, audits };
}

describe('Field Training recorded lectures provider', () => {
  it('normalizes YouTube and Vimeo without calling remote APIs', () => {
    assert.equal(provider.normalizeProvider('YOUTUBE'), 'youtube');
    assert.equal(provider.normalizeProvider('vimeo'), 'vimeo');
    assert.deepEqual(
      provider.validateVideoReference({ provider: 'YOUTUBE', providerVideoId: VIDEO_ID }),
      { provider: 'youtube', providerVideoId: VIDEO_ID }
    );
    const embed = provider.getEmbedReference({
      provider: 'vimeo',
      providerVideoId: '123456789',
    });
    assert.equal(embed.provider, 'VIMEO');
    assert.equal(embed.embedKind, 'vimeo_embed');
  });

  it('rejects raw URLs so identity stays provider + video id', () => {
    assert.throws(
      () =>
        provider.validateVideoReference({
          provider: 'YOUTUBE',
          providerVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        }),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
  });
});

describe('Field Training recorded lectures service', () => {
  it('lets an authorized university admin create a lecture under their opportunity', async () => {
    const { service, store } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const result = await service.createForOpportunity(
      ZARQA_OPP,
      {
        title: ' React Components ',
        provider: 'YOUTUBE',
        provider_video_id: VIDEO_ID,
      },
      admin
    );
    assert.equal(result.lecture.title, 'React Components');
    assert.equal(result.lecture.provider, 'YOUTUBE');
    assert.equal(result.lecture.status, 'DRAFT');
    assert.equal(result.lecture.sort_order, 0);
    assert.equal(store.lectures.length, 1);
    assert.equal(store.lectures[0].created_by_id, admin.userId);
  });

  it('rejects the same provider video twice in one opportunity', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const body = { title: 'A', provider: 'YOUTUBE', provider_video_id: VIDEO_ID };
    await service.createForOpportunity(ZARQA_OPP, body, admin);
    await assert.rejects(
      () => service.createForOpportunity(ZARQA_OPP, { ...body, title: 'B' }, admin),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 409 &&
        err.message === 'هذا الفيديو مضاف مسبقًا لهذه الفرصة التدريبية.'
    );
  });

  it('allows the same video on a different opportunity', async () => {
    const { service } = createHarness();
    const zarqaAdmin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const tafilaAdmin = user({ roles: ['admin'], universityId: TAFILA_UNI });
    await service.createForOpportunity(
      ZARQA_OPP,
      { title: 'Zarqa', provider: 'YOUTUBE', provider_video_id: VIDEO_ID },
      zarqaAdmin
    );
    const other = await service.createForOpportunity(
      TAFILA_OPP,
      { title: 'Tafila', provider: 'YOUTUBE', provider_video_id: VIDEO_ID },
      tafilaAdmin
    );
    assert.equal(other.lecture.opportunity_id, TAFILA_OPP);
    assert.equal(other.lecture.provider_video_id, VIDEO_ID);
  });

  it('rejects a session that belongs to another opportunity', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    await assert.rejects(
      () =>
        service.createForOpportunity(
          ZARQA_OPP,
          {
            title: 'Mismatch',
            provider: 'YOUTUBE',
            provider_video_id: VIDEO_ID,
            session_id: TAFILA_SESSION,
          },
          admin
        ),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 400 &&
        err.message === 'الجلسة المحددة لا تتبع نفس فرصة التدريب.'
    );
  });

  it('lets students see only PUBLISHED lectures for their enrolled opportunity', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const draft = await service.createForOpportunity(
      ZARQA_OPP,
      { title: 'Draft', provider: 'YOUTUBE', provider_video_id: 'aaaaaaaaaaa' },
      admin
    );
    const hidden = await service.createForOpportunity(
      ZARQA_OPP,
      { title: 'Hidden', provider: 'YOUTUBE', provider_video_id: 'bbbbbbbbbbb', status: 'HIDDEN' },
      admin
    );
    const published = await service.createForOpportunity(
      ZARQA_OPP,
      {
        title: 'Published',
        provider: 'YOUTUBE',
        provider_video_id: VIDEO_ID,
        status: 'PUBLISHED',
      },
      admin
    );

    const listed = await service.listForStudent(ZARQA_OPP, STUDENT_ZARQA);
    assert.equal(listed.lectures.length, 1);
    assert.equal(listed.lectures[0].id, published.lecture.id);
    assert.equal(listed.lectures[0].provider, 'YOUTUBE');
    assert.equal(listed.lectures[0].providerVideoId, VIDEO_ID);
    assert.equal('created_by_id' in listed.lectures[0], false);
    assert.equal('status' in listed.lectures[0], false);
    assert.equal('segments' in listed.lectures[0], false);
    assert.equal('sourcePlaylistId' in listed.lectures[0], false);
    assert.equal('watchSessionId' in (listed.lectures[0].progress || {}), false);
    assert.equal(listed.summary.total, 1);
    assert.equal(listed.summary.completed, 0);

    await assert.rejects(
      () => service.getForStudent(ZARQA_OPP, draft.lecture.id, STUDENT_ZARQA),
      (err) => err.statusCode === 404
    );
    await assert.rejects(
      () => service.getForStudent(ZARQA_OPP, hidden.lecture.id, STUDENT_ZARQA),
      (err) => err.statusCode === 404
    );
  });

  it('blocks a student from another opportunity even with a guessed id', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    await service.createForOpportunity(
      ZARQA_OPP,
      { title: 'Published', provider: 'YOUTUBE', provider_video_id: VIDEO_ID, status: 'PUBLISHED' },
      admin
    );
    await assert.rejects(
      () => service.listForStudent(ZARQA_OPP, STUDENT_OTHER),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('returns twenty published lectures in admin sortOrder with a list summary', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const created = [];
    for (let i = 0; i < 20; i += 1) {
      const result = await service.createForOpportunity(
        ZARQA_OPP,
        {
          title: `Zebra ${20 - i}`,
          provider: 'YOUTUBE',
          provider_video_id: `vid${String(i).padStart(8, '0')}`,
          status: 'PUBLISHED',
        },
        admin
      );
      created.push(result.lecture);
    }
    for (let i = 0; i < created.length; i += 1) {
      await service.updateLecture(created[i].id, { sort_order: 100 - i }, admin);
    }
    const listed = await service.listForStudent(ZARQA_OPP, STUDENT_ZARQA);
    assert.equal(listed.summary.total, 20);
    assert.equal(listed.summary.completed, 0);
    assert.deepEqual(
      listed.lectures.map((row) => row.sortOrder),
      [...Array(20).keys()].map((i) => 81 + i)
    );
    assert.equal(listed.lectures[0].id, created[created.length - 1].id);
    assert.equal(
      listed.lectures.every((row) => !('segments' in row) && !('sourcePlaylistId' in row)),
      true
    );
    const first = await service.getForStudent(ZARQA_OPP, listed.lectures[0].id, STUDENT_ZARQA);
    const last = await service.getForStudent(ZARQA_OPP, listed.lectures[19].id, STUDENT_ZARQA);
    assert.equal(first.previous, null);
    assert.equal(first.next.id, listed.lectures[1].id);
    assert.equal(last.next, null);
    assert.equal(last.previous.id, listed.lectures[18].id);
  });

  it('lets a reviewer read but not mutate', async () => {
    const { service } = createHarness();
    const admin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    const reviewer = user({ roles: ['reviewer'], universityId: ZARQA_UNI });
    await service.createForOpportunity(
      ZARQA_OPP,
      { title: 'Read me', provider: 'YOUTUBE', provider_video_id: VIDEO_ID },
      admin
    );
    const listed = await service.listForStaff(ZARQA_OPP, reviewer);
    assert.equal(listed.lectures.length, 1);
    await assert.rejects(
      () =>
        service.createForOpportunity(
          ZARQA_OPP,
          { title: 'Nope', provider: 'YOUTUBE', provider_video_id: 'ccccccccccc' },
          reviewer
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
    await assert.rejects(
      () => service.listForStaff(TAFILA_OPP, reviewer),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies a Zarqa admin from managing Tafila lectures', async () => {
    const { service } = createHarness();
    const zarqaAdmin = user({ roles: ['admin'], universityId: ZARQA_UNI });
    await assert.rejects(
      () =>
        service.createForOpportunity(
          TAFILA_OPP,
          { title: 'Cross', provider: 'YOUTUBE', provider_video_id: VIDEO_ID },
          zarqaAdmin
        ),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('denies institution users from University Field Training lectures', async () => {
    const { service } = createHarness();
    const institutionAdmin = user({
      roles: ['admin'],
      universityId: ZARQA_UNI,
      organizationType: 'INSTITUTION',
    });
    await assert.rejects(
      () => service.listForStaff(ZARQA_OPP, institutionAdmin),
      (err) => err instanceof ApiError && err.statusCode === 403
    );
  });

  it('assigns deterministic sort order and maps duplicate prisma errors', () => {
    assert.equal(nextSortOrder(null), 0);
    assert.equal(nextSortOrder(3), 4);
    assert.equal(normalizeStatus('PUBLISHED'), 'published');
    const mapped = mapDuplicateError({
      code: 'P2002',
      meta: { target: ['opportunity_id', 'provider', 'provider_video_id'] },
    });
    assert.equal(mapped.statusCode, 409);
  });
});

describe('Field Training recorded lectures permissions and isolation', () => {
  it('does not grant lecture management to reviewer or student', () => {
    const opp = { id: ZARQA_OPP, university_id: ZARQA_UNI, assigned_instructor_id: null };
    assert.equal(canManageFieldTraining({ isGlobal: true, roles: ['super_admin'] }, opp), true);
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_UNI, roles: ['admin'] }, opp),
      true
    );
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_UNI, roles: ['reviewer'] }, opp),
      false
    );
    assert.equal(
      canManageFieldTraining({ isGlobal: false, universityId: ZARQA_UNI, roles: ['student'] }, opp),
      false
    );
  });

  it('keeps academic routes read-only and student routes free of mutations', () => {
    const academic = read('src/modules/fieldTraining/academicFieldTraining.routes.js');
    const student = read('src/modules/fieldTraining/studentFieldTraining.routes.js');
    const recorded = read('src/modules/fieldTraining/fieldTraining.recordedLectures.routes.js');
    assert.match(academic, /mountReadRoutes/);
    assert.equal(/mountManageRoutes/.test(academic), false);
    assert.match(student, /mountStudentRoutes/);
    assert.match(student, /requireOrganizationType\('UNIVERSITY'\)/);
    assert.equal(/createForOpportunity/.test(student), false);
    assert.equal(/router\.delete\(\s*'\/recorded-lectures/.test(recorded), false);
    assert.match(recorded, /publish/);
    assert.match(recorded, /hide/);
    assert.match(recorded, /recorded-lectures\/youtube\/preview/);
    assert.match(recorded, /recorded-lectures\/youtube\/playlist\/import/);
    assert.match(recorded, /recorded-lectures\/reorder/);
    assert.match(recorded, /playlist\/sync/);
    assert.equal(/youtube/.test(academic), false);
    assert.equal(/youtube/.test(student), false);
  });

  it('does not change Field Training scoring, attendance, or eligibility models', () => {
    const policy = read('src/modules/fieldTraining/fieldTraining.policy.service.js');
    assert.match(policy, /FIXED_COMPONENTS_20_20_40_20_V1/);
    const sql = read(
      'prisma/migrations/20260912140000_field_training_recorded_lectures/migration.sql'
    );
    assert.match(sql, /field_training_recorded_lectures/);
    assert.equal(/field_training_attendance/i.test(sql) && /ALTER TABLE "field_training_attendance"/.test(sql), false);
    assert.equal(/ALTER TABLE "field_training_applications"/.test(sql), false);
    assert.equal(/ALTER TABLE "field_training_assessments"/.test(sql), false);
    assert.equal(/DROP TABLE/.test(sql), false);
    assert.match(sql, /uq_ft_recorded_lectures_opp_provider_video/);
    assert.match(sql, /idx_ft_recorded_lectures_opp_status_sort/);
  });
});
