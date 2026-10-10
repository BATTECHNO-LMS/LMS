'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');
const request = require('supertest');

// Must run before the workflow module loads: it destructures emitDomainEvent at require time.
require('../src/modules/notificationEngine/notificationDispatcher.service').emitDomainEvent = async () => null;

const rules = require('../src/modules/trainingPrograms/taskSubmissionFileRules');
const svc = require('../src/modules/trainingPrograms/taskSubmissionFiles.service');
const workflow = require('../src/modules/trainingPrograms/trainingTaskWorkflow.service');
const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');
const filesRepo = require('../src/modules/files/files.repository');

const TASK_ID = '11111111-1111-4111-8111-111111111111';
const SUB_ID = '22222222-2222-4222-8222-222222222222';
const FILE_A = '33333333-3333-4333-8333-333333333333';
const FILE_B = '44444444-4444-4444-8444-444444444444';
const OWNER = { userId: '55555555-5555-4555-8555-555555555555', roles: ['trainee'] };

function stubAll(target, stubs) {
  const originals = {};
  for (const [k, v] of Object.entries(stubs)) {
    originals[k] = target[k];
    target[k] = v;
  }
  return () => Object.assign(target, originals);
}

describe('taskSubmissionFileRules', () => {
  it('accepts broad types including archives, design and unknown extensions', () => {
    for (const name of ['report.docx', 'data.xlsx', 'slides.pptx', 'clip.mp4', 'voice.m4a', 'site.zip', 'pack.rar', 'pack.7z', 'src.tar.gz', 'mock.fig', 'model.blend', 'notes']) {
      const out = rules.validateSubmissionFile({ fileName: name, mimeType: '', size: 10 });
      assert.equal(out.valid, true, name);
    }
    assert.equal(rules.validateSubmissionFile({ fileName: 'pack.rar', mimeType: 'application/x-compressed', size: 5 }).isArchive, true);
    assert.equal(rules.validateSubmissionFile({ fileName: 'mock.fig', mimeType: '', size: 5 }).mimeType, 'application/octet-stream');
  });

  it('blocks executables including double extensions and trailing dots', () => {
    for (const name of ['setup.exe', 'report.pdf.exe', 'run.bat', 'evil.exe.', 'x.MSI', 'app.apk', 'script.ps1']) {
      const out = rules.validateSubmissionFile({ fileName: name, mimeType: 'application/pdf', size: 10 });
      assert.equal(out.valid, false, name);
      assert.equal(out.code, 'FILE_TYPE_BLOCKED');
    }
  });

  it('rejects empty and oversized files', () => {
    assert.equal(rules.validateSubmissionFile({ fileName: 'a.pdf', size: 0 }).code, 'FILE_EMPTY');
    assert.equal(
      rules.validateSubmissionFile({ fileName: 'a.pdf', size: rules.MAX_FILE_BYTES + 1 }).code,
      'FILE_TOO_LARGE'
    );
  });

  it('enforces file count and total size per submission', () => {
    const many = Array.from({ length: rules.MAX_FILES_PER_SUBMISSION + 1 }, () => ({ size: 1 }));
    assert.equal(rules.validateSubmissionFileSet(many).code, 'TOO_MANY_FILES');
    const big = [{ size: rules.MAX_TOTAL_SUBMISSION_BYTES }, { size: 1 }];
    assert.equal(rules.validateSubmissionFileSet(big).code, 'TOTAL_SIZE_EXCEEDED');
    assert.equal(rules.validateSubmissionFileSet([{ size: 5 }, { size: 6 }]).totalBytes, 11);
  });

  it('recovers UTF-8 Arabic names that busboy decoded as latin1', () => {
    const arabic = 'تقرير المشروع.pdf';
    const garbled = Buffer.from(arabic, 'utf8').toString('latin1');
    assert.equal(rules.decodeMultipartFileName(garbled), arabic);
    assert.equal(rules.decodeMultipartFileName('plain.pdf'), 'plain.pdf');
    assert.equal(rules.decodeMultipartFileName(arabic), arabic);
  });

  it('normalizes display names: no paths, control chars, keeps extension when truncating', () => {
    assert.equal(rules.normalizeOriginalName('../../etc/passwd'), 'passwd');
    assert.equal(rules.normalizeOriginalName('C:\\Users\\me\\a<b>.txt'), 'a_b_.txt');
    assert.equal(rules.normalizeOriginalName('bad\u0000name.pdf'), 'badname.pdf');
    const long = `${'ب'.repeat(400)}.docx`;
    const out = rules.normalizeOriginalName(long);
    assert.ok(out.length <= 255);
    assert.ok(out.endsWith('.docx'));
  });

  it('never serves active content inline', () => {
    assert.equal(rules.downloadContentType('text/html'), 'application/octet-stream');
    assert.equal(rules.downloadContentType('image/svg+xml'), 'application/octet-stream');
    assert.equal(rules.downloadContentType('text/plain'), 'application/octet-stream');
    assert.equal(rules.downloadContentType('application/pdf'), 'application/pdf');
  });

  it('builds a safe attachment Content-Disposition with UTF-8 filename*', () => {
    const header = rules.attachmentDisposition('تقرير "نهائي";.pdf');
    assert.match(header, /^attachment; filename="[^"]*"; filename\*=UTF-8''/);
    assert.ok(!/filename="[^"]*"[^;]*"/.test(header.split(';').slice(0, 2).join(';')));
    assert.ok(header.includes(encodeURIComponent('تقرير')));
  });
});

describe('taskSubmissionFiles.service uploadDraftFile', () => {
  let restore = [];
  let tmpFile;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `task-upload-test-${Date.now()}-${Math.random()}.part`);
    fs.writeFileSync(tmpFile, 'hello');
    restore = [
      stubAll(workflow, {
        loadTaskOrThrow: async () => ({ id: TASK_ID, published_at: new Date(), due_at: null, max_attempts: 3, allow_resubmit: true, training_programs: { organization_id: 'org' } }),
        findActiveEnrollment: async () => ({ id: '66666666-6666-4666-8666-666666666666' }),
      }),
      stubAll(prisma.training_task_submissions, { findMany: async () => [] }),
      stubAll(prisma.files, { count: async () => 0 }),
    ];
  });

  afterEach(() => {
    restore.reverse().forEach((r) => r());
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('rejects blocked files before touching storage and removes the temp file', async () => {
    let stored = false;
    restore.push(stubAll(getProvider(), { putObjectFile: async () => { stored = true; } }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'x.exe', mimetype: 'application/octet-stream', size: 5 }),
      (err) => err.code === 'FILE_TYPE_BLOCKED' && err.statusCode === 400 && /[\u0600-\u06FF]/.test(err.message)
    );
    assert.equal(stored, false);
    assert.equal(fs.existsSync(tmpFile), false);
  });

  it('returns 413 FILE_TOO_LARGE with an Arabic message for oversized files', async () => {
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'big.mp4', mimetype: 'video/mp4', size: rules.MAX_FILE_BYTES + 1 }),
      (err) => err.code === 'FILE_TOO_LARGE' && err.statusCode === 413
    );
  });

  it('refuses when the draft count limit is reached', async () => {
    restore.push(stubAll(prisma.files, { count: async () => rules.MAX_FILES_PER_SUBMISSION }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'a.pdf', mimetype: 'application/pdf', size: 5 }),
      (err) => err.code === 'TOO_MANY_FILES'
    );
  });

  it('refuses when not enrolled', async () => {
    restore.push(stubAll(workflow, { findActiveEnrollment: async () => null }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'a.pdf', mimetype: 'application/pdf', size: 5 }),
      (err) => err.statusCode === 403
    );
  });

  it('maps storage failures to a safe Arabic STORAGE_ERROR without leaking provider details', async () => {
    restore.push(stubAll(getProvider(), {
      putObjectFile: async () => { throw new Error('S3 AccessDenied secret-bucket'); },
      deleteObject: async () => true,
    }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'a.pdf', mimetype: 'application/pdf', size: 5 }),
      (err) => err.code === 'STORAGE_ERROR' && err.statusCode === 503 && !/S3|secret/.test(err.message)
    );
  });

  it('deletes the stored object when the DB record fails (no orphan)', async () => {
    const deleted = [];
    restore.push(stubAll(getProvider(), {
      putObjectFile: async () => ({ size: 5 }),
      deleteObject: async (key) => { deleted.push(key); return true; },
    }));
    restore.push(stubAll(filesRepo, { createFile: async () => { throw new Error('Prisma P2002'); } }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'a.pdf', mimetype: 'application/pdf', size: 5 }),
      (err) => err.code === 'STORAGE_ERROR' && !/Prisma/.test(err.message)
    );
    assert.equal(deleted.length, 1);
    assert.match(deleted[0], /^uploads\/training\//);
  });

  it('stores a draft with collision-safe key and original Arabic name as metadata', async () => {
    let createdWith;
    restore.push(stubAll(getProvider(), { putObjectFile: async () => ({ size: 5 }) }));
    restore.push(stubAll(filesRepo, {
      createFile: async (data) => {
        createdWith = data;
        return { id: FILE_A, originalName: data.originalName, mimeType: data.mimeType, size: data.size };
      },
    }));
    const garbled = Buffer.from('مشروع التخرج.rar', 'utf8').toString('latin1');
    const out = await svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: garbled, mimetype: 'application/x-compressed', size: 5 });
    assert.equal(out.originalName, 'مشروع التخرج.rar');
    assert.equal(out.isArchive, true);
    assert.equal(createdWith.relatedEntityType, rules.DRAFT_ENTITY_TYPE);
    assert.equal(createdWith.relatedEntityId, TASK_ID);
    assert.equal(createdWith.visibility, 'private');
    assert.match(createdWith.storageKey, /^uploads\/training\/\d{4}\/\d{2}\/[0-9a-f-]{36}-/);
    assert.equal(fs.existsSync(tmpFile), false);
  });

  it('blocks uploads after the deadline', async () => {
    restore.push(stubAll(workflow, {
      loadTaskOrThrow: async () => ({ id: TASK_ID, published_at: new Date(), due_at: new Date(Date.now() - 1000), training_programs: {} }),
    }));
    await assert.rejects(
      () => svc.uploadDraftFile(OWNER, TASK_ID, { path: tmpFile, originalname: 'a.pdf', mimetype: 'application/pdf', size: 5 }),
      (err) => err.code === 'TASK_NOT_AVAILABLE'
    );
  });
});

describe('taskSubmissionFiles.service submit helpers', () => {
  let restore = [];
  afterEach(() => {
    restore.reverse().forEach((r) => r());
    restore = [];
  });

  it('rejects file ids that are not the requester\'s live drafts for this task', async () => {
    restore.push(stubAll(prisma.files, { findMany: async () => [{ id: FILE_A, size: 5n, storage_key: 'uploads/training/a' }] }));
    await assert.rejects(
      () => svc.resolveDraftFilesForSubmit(OWNER, TASK_ID, [FILE_A, FILE_B]),
      (err) => err.code === 'FILE_NOT_AVAILABLE'
    );
    await assert.rejects(
      () => svc.resolveDraftFilesForSubmit(OWNER, TASK_ID, ['not-a-uuid']),
      (err) => err.code === 'FILE_NOT_AVAILABLE'
    );
  });

  it('rejects when a stored object is missing (never marks submitted without files)', async () => {
    restore.push(stubAll(prisma.files, {
      findMany: async () => [{ id: FILE_A, size: 5n, storage_key: 'uploads/training/a' }],
    }));
    restore.push(stubAll(getProvider(), { headObject: async () => null }));
    await assert.rejects(
      () => svc.resolveDraftFilesForSubmit(OWNER, TASK_ID, [FILE_A]),
      (err) => err.code === 'FILE_NOT_AVAILABLE'
    );
  });

  it('returns verified drafts in requested order', async () => {
    restore.push(stubAll(prisma.files, {
      findMany: async () => [
        { id: FILE_B, size: 2n, storage_key: 'uploads/training/b' },
        { id: FILE_A, size: 1n, storage_key: 'uploads/training/a' },
      ],
    }));
    restore.push(stubAll(getProvider(), { headObject: async () => ({ size: 1 }) }));
    const rows = await svc.resolveDraftFilesForSubmit(OWNER, TASK_ID, [FILE_A, FILE_B, FILE_A]);
    assert.deepEqual(rows.map((r) => r.id), [FILE_A, FILE_B]);
  });

  it('throws inside the transaction when a draft was claimed concurrently (rollback)', async () => {
    const tx = {
      files: { updateMany: async () => ({ count: 1 }) },
      training_task_submission_files: { createMany: async () => { throw new Error('should not run'); } },
    };
    await assert.rejects(
      () => svc.attachFilesInTransaction(tx, SUB_ID, TASK_ID, OWNER, [
        { id: FILE_A, storage_key: 'uploads/training/a', original_name: 'a.pdf', mime_type: 'application/pdf', size: 1n },
        { id: FILE_B, storage_key: 'uploads/training/b', original_name: 'b.zip', mime_type: 'application/zip', size: 1n },
      ]),
      (err) => err.code === 'FILE_NOT_AVAILABLE'
    );
  });

  it('links drafts and records attachment rows with archive flag', async () => {
    let created;
    const tx = {
      files: { updateMany: async () => ({ count: 2 }) },
      training_task_submission_files: { createMany: async ({ data }) => { created = data; return { count: data.length }; } },
    };
    await svc.attachFilesInTransaction(tx, SUB_ID, TASK_ID, OWNER, [
      { id: FILE_A, storage_key: 'uploads/training/a', original_name: 'a.pdf', mime_type: 'application/pdf', size: 1n },
      { id: FILE_B, storage_key: 'uploads/training/b', original_name: 'b.7z', mime_type: 'application/octet-stream', size: 1n },
    ]);
    assert.equal(created.length, 2);
    assert.equal(created[0].sort_order, 0);
    assert.equal(created[1].is_archive, true);
    assert.equal(created[0].submission_id, SUB_ID);
  });
});

describe('trainingTaskWorkflow.submitTask with files', () => {
  let restore = [];
  afterEach(() => {
    restore.reverse().forEach((r) => r());
    restore = [];
  });

  function baseStubs() {
    restore.push(stubAll(prisma.training_tasks, {
      findUnique: async () => ({
        id: TASK_ID, program_id: 'p', cohort_id: null, published_at: new Date(), due_at: null,
        max_attempts: 3, allow_resubmit: true, grading_mode: 'MANUAL',
        training_programs: { organization_id: 'org' },
      }),
    }));
    restore.push(stubAll(prisma.training_enrollments, {
      findFirst: async () => ({ id: '66666666-6666-4666-8666-666666666666' }),
      findUnique: async () => null,
    }));
    restore.push(stubAll(prisma.training_task_submissions, { findMany: async () => [] }));
    restore.push(stubAll(prisma.audit_logs, { create: async () => ({}) }));
    restore.push(stubAll(prisma.users, { findUnique: async () => null }));
  }

  it('rejects an empty submission (no text, no files)', async () => {
    baseStubs();
    await assert.rejects(
      () => workflow.submitTask(OWNER, TASK_ID, { content_text: '   ', file_ids: [] }),
      (err) => err.code === 'SUBMISSION_EMPTY'
    );
  });

  it('does not create a submission when a file is unavailable', async () => {
    baseStubs();
    let txCalled = false;
    restore.push(stubAll(prisma, { $transaction: async () => { txCalled = true; } }));
    restore.push(stubAll(prisma.files, { findMany: async () => [] }));
    await assert.rejects(
      () => workflow.submitTask(OWNER, TASK_ID, { file_ids: [FILE_A] }),
      (err) => err.code === 'FILE_NOT_AVAILABLE'
    );
    assert.equal(txCalled, false);
  });

  it('creates submission and attachments in one transaction', async () => {
    baseStubs();
    const calls = [];
    restore.push(stubAll(prisma.files, {
      findMany: async (args) =>
        args?.where?.created_at
          ? []
          : [{ id: FILE_A, size: 3n, storage_key: 'uploads/training/a', original_name: 'a.pdf', mime_type: 'application/pdf' }],
    }));
    restore.push(stubAll(getProvider(), { headObject: async () => ({ size: 3 }) }));
    restore.push(stubAll(prisma, {
      $transaction: async (fn) =>
        fn({
          training_task_submissions: {
            create: async ({ data }) => {
              calls.push(['create', data]);
              return { id: SUB_ID, attempt_no: data.attempt_no, status: data.status };
            },
          },
          files: { updateMany: async () => { calls.push(['claim']); return { count: 1 }; } },
          training_task_submission_files: { createMany: async ({ data }) => { calls.push(['attach', data.length]); return { count: data.length }; } },
        }),
    }));
    const out = await workflow.submitTask(OWNER, TASK_ID, { content_text: 'ملاحظة', file_ids: [FILE_A] });
    assert.equal(out.id, SUB_ID);
    assert.equal(out.fileCount, 1);
    assert.deepEqual(calls.map((c) => c[0]), ['create', 'claim', 'attach']);
    assert.equal(calls[0][1].content_url, null);
    assert.equal(calls[0][1].content_text, 'ملاحظة');
  });
});

describe('submission file download access', () => {
  let restore = [];
  afterEach(() => {
    restore.reverse().forEach((r) => r());
    restore = [];
  });

  const submission = {
    id: SUB_ID,
    user_id: '55555555-5555-4555-8555-555555555555',
    content_url: 'uploads/training/2026/10/0b9b8f8e-1111-4111-8111-111111111111-old.pdf',
    training_tasks: { program_id: 'p', training_programs: { organization_id: 'org' } },
  };

  it('denies another student (not owner, not staff)', async () => {
    restore.push(stubAll(workflow, { loadSubmissionOrThrow: async () => submission }));
    await assert.rejects(
      () => svc.openSubmissionAttachment({ userId: 'other', roles: ['trainee'] }, SUB_ID, FILE_A),
      (err) => err.statusCode === 403
    );
  });

  it('lets the owner download with original name', async () => {
    restore.push(stubAll(workflow, { loadSubmissionOrThrow: async () => submission }));
    restore.push(stubAll(prisma.training_task_submission_files, {
      findFirst: async () => ({ id: FILE_A, storage_key: 'uploads/training/a', original_name: 'تقرير.pdf', mime_type: 'application/pdf' }),
    }));
    restore.push(stubAll(getProvider(), { getObjectStream: async () => ({ stream: PassThrough.from(['x']), contentLength: 1 }) }));
    const out = await svc.openSubmissionAttachment(OWNER, SUB_ID, FILE_A);
    assert.equal(out.fileName, 'تقرير.pdf');
  });

  it('resolves legacy content_url keys safely', () => {
    assert.equal(svc.normalizeLegacyStorageKey('uploads/training/a.pdf'), 'uploads/training/a.pdf');
    assert.equal(svc.normalizeLegacyStorageKey('/uploads/training/a.pdf'), 'uploads/training/a.pdf');
    assert.equal(svc.normalizeLegacyStorageKey('https://eprojecto.com/uploads/training/a.pdf'), 'uploads/training/a.pdf');
    assert.equal(svc.normalizeLegacyStorageKey('uploads/../../etc/passwd'), null);
    assert.equal(svc.normalizeLegacyStorageKey('https://drive.example.com/file'), null);
    assert.equal(svc.legacyDisplayName(submission.content_url), 'old.pdf');
  });

  it('streams downloads as attachment with nosniff and sandbox CSP', async () => {
    const controller = require('../src/modules/trainingPrograms/taskSubmissionFiles.controller');
    restore.push(stubAll(svc, {
      openSubmissionAttachment: async () => ({
        stream: PassThrough.from([Buffer.from('<html>x</html>')]),
        contentLength: 14,
        fileName: 'page.html',
        mimeType: 'text/html',
      }),
    }));
    const res = new PassThrough();
    const headers = {};
    res.setHeader = (k, v) => { headers[k.toLowerCase()] = v; };
    res.headersSent = false;
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve) => res.on('end', resolve));
    await controller.downloadAttachment(
      { user: OWNER, validated: { params: { submissionId: SUB_ID, fileId: FILE_A } } },
      res,
      (err) => { throw err; }
    );
    await done;
    assert.equal(headers['content-type'], 'application/octet-stream');
    assert.match(headers['content-disposition'], /^attachment;/);
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.match(headers['content-security-policy'], /sandbox/);
    assert.equal(headers['cache-control'], 'private, no-store');
    assert.equal(Buffer.concat(chunks).toString(), '<html>x</html>');
  });
});

describe('task submission routes require authentication', () => {
  const app = require('../src/app');

  it('POST upload requires auth', async () => {
    const res = await request(app).post(`/api/v1/training/tasks/${TASK_ID}/submission-files`);
    assert.equal(res.status, 401);
  });

  it('GET drafts requires auth', async () => {
    const res = await request(app).get(`/api/v1/training/tasks/${TASK_ID}/submission-files`);
    assert.equal(res.status, 401);
  });

  it('DELETE draft requires auth', async () => {
    const res = await request(app).delete(`/api/v1/training/tasks/${TASK_ID}/submission-files/${FILE_A}`);
    assert.equal(res.status, 401);
  });

  it('GET attachment download requires auth', async () => {
    const res = await request(app).get(`/api/v1/training/task-submissions/${SUB_ID}/files/${FILE_A}/download`);
    assert.equal(res.status, 401);
  });

  it('GET legacy download requires auth', async () => {
    const res = await request(app).get(`/api/v1/training/task-submissions/${SUB_ID}/legacy-file/download`);
    assert.equal(res.status, 401);
  });
});
