'use strict';

/**
 * ACADEMIC-SUBMISSION-001: one submission per assessment+student (database-free).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');

const {
  ACADEMIC_SUBMISSION_EXISTS,
  SUBMISSION_EXISTS_MESSAGE,
  assertNoExistingAcademicSubmission,
  mapAcademicSubmissionUniqueConflict,
} = require('../src/modules/submissions/submissions.lifecycle');
const { ApiError } = require('../src/utils/apiError');

const ASSESSMENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_STUDENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SUBMISSION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('ACADEMIC-SUBMISSION-001 uniqueness', () => {
  it('assertNoExistingAcademicSubmission allows first create', () => {
    assert.doesNotThrow(() => assertNoExistingAcademicSubmission(null));
  });

  it('assertNoExistingAcademicSubmission rejects duplicate with 409 code', () => {
    assert.throws(
      () => assertNoExistingAcademicSubmission({ id: SUBMISSION_ID }),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 409 &&
        err.code === ACADEMIC_SUBMISSION_EXISTS &&
        err.message === SUBMISSION_EXISTS_MESSAGE
    );
  });

  it('mapAcademicSubmissionUniqueConflict maps P2002 without exposing Prisma', () => {
    const mapped = mapAcademicSubmissionUniqueConflict({
      code: 'P2002',
      meta: { target: ['assessment_id', 'student_id'] },
      message: 'Unique constraint failed on the fields: (`assessment_id`,`student_id`)',
    });
    assert.ok(mapped instanceof ApiError);
    assert.equal(mapped.statusCode, 409);
    assert.equal(mapped.code, ACADEMIC_SUBMISSION_EXISTS);
    assert.equal(String(mapped.message).includes('P2002'), false);
    assert.equal(mapAcademicSubmissionUniqueConflict({ code: 'P2003' }), null);
  });

  it('createForAssessment checks existence before repo.create and maps races', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'submissions', 'submissions.service.js'),
      'utf8'
    );
    assert.match(src, /findByAssessmentAndStudent/);
    assert.match(src, /assertNoExistingAcademicSubmission/);
    assert.match(src, /mapAcademicSubmissionUniqueConflict/);
  });

  it('repository create maps unique conflicts; update path unchanged', () => {
    const repo = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'submissions', 'submissions.repository.js'),
      'utf8'
    );
    assert.match(repo, /mapAcademicSubmissionUniqueConflict/);
    assert.match(repo, /findByAssessmentAndStudent/);
    assert.match(repo, /async function update/);
  });

  it('schema and migration declare compound unique on assessment_id+student_id', () => {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    assert.match(schema, /@@unique\(\[assessment_id, student_id\].*uq_submissions_assessment_student/);
    const mig = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        'prisma',
        'migrations',
        '20260718120000_academic_submission_uniqueness',
        'migration.sql'
      ),
      'utf8'
    );
    assert.match(mig, /uq_submissions_assessment_student/);
    assert.match(mig, /CREATE UNIQUE INDEX/);
    assert.equal(/DELETE FROM|TRUNCATE|DROP TABLE/i.test(mig), false);
  });

  it('direct service create rejects when existing row found without calling create', async () => {
    const servicePath = require.resolve('../src/modules/submissions/submissions.service');
    const repoPath = require.resolve('../src/modules/submissions/submissions.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const enrollmentsRepoPath = require.resolve('../src/modules/enrollments/enrollments.repository');

    delete require.cache[servicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const enrollmentsRepo = require(enrollmentsRepoPath);

    const originals = {
      findById: assessmentsRepo.findById,
      findByCohortAndStudent: enrollmentsRepo.findByCohortAndStudent,
      findAnyFinalGrade: repo.findAnyFinalGrade,
      findByAssessmentAndStudent: repo.findByAssessmentAndStudent,
      create: repo.create,
    };

    let createCalled = false;
    assessmentsRepo.findById = async () => ({
      id: ASSESSMENT_ID,
      cohort_id: ASSESSMENT_ID,
      due_date: new Date(Date.now() + 86400000),
    });
    enrollmentsRepo.findByCohortAndStudent = async () => ({ enrollment_status: 'enrolled' });
    repo.findAnyFinalGrade = async () => null;
    repo.findByAssessmentAndStudent = async () => ({ id: SUBMISSION_ID, assessment_id: ASSESSMENT_ID });
    repo.create = async () => {
      createCalled = true;
      throw new Error('create must not run');
    };

    try {
      const service = require(servicePath);
      await assert.rejects(
        () =>
          service.createForAssessment(
            ASSESSMENT_ID,
            { submission_type: 'text_response', text_response: 'x' },
            { userId: STUDENT_ID, roles: ['student'], isGlobal: false }
          ),
        (err) => err.statusCode === 409 && err.code === ACADEMIC_SUBMISSION_EXISTS
      );
      assert.equal(createCalled, false);
    } finally {
      Object.assign(assessmentsRepo, {
        findById: originals.findById,
      });
      Object.assign(enrollmentsRepo, {
        findByCohortAndStudent: originals.findByCohortAndStudent,
      });
      Object.assign(repo, {
        findAnyFinalGrade: originals.findAnyFinalGrade,
        findByAssessmentAndStudent: originals.findByAssessmentAndStudent,
        create: originals.create,
      });
      delete require.cache[servicePath];
    }
  });

  it('direct service create succeeds when no existing row', async () => {
    const servicePath = require.resolve('../src/modules/submissions/submissions.service');
    const repoPath = require.resolve('../src/modules/submissions/submissions.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const enrollmentsRepoPath = require.resolve('../src/modules/enrollments/enrollments.repository');
    const { prisma } = require('../src/config/db');

    delete require.cache[servicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const enrollmentsRepo = require(enrollmentsRepoPath);

    const originals = {
      findById: assessmentsRepo.findById,
      findByCohortAndStudent: enrollmentsRepo.findByCohortAndStudent,
      findAnyFinalGrade: repo.findAnyFinalGrade,
      findByAssessmentAndStudent: repo.findByAssessmentAndStudent,
      create: repo.create,
      users: prisma.users.findMany,
    };

    assessmentsRepo.findById = async () => ({
      id: ASSESSMENT_ID,
      cohort_id: ASSESSMENT_ID,
      due_date: new Date(Date.now() + 86400000),
    });
    enrollmentsRepo.findByCohortAndStudent = async () => ({ enrollment_status: 'enrolled' });
    repo.findAnyFinalGrade = async () => null;
    repo.findByAssessmentAndStudent = async () => null;
    repo.create = async (data) => ({
      id: SUBMISSION_ID,
      ...data,
      submitted_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      assessments: null,
    });
    prisma.users.findMany = async () => [];

    try {
      const service = require(servicePath);
      const out = await service.createForAssessment(
        ASSESSMENT_ID,
        { submission_type: 'text_response', text_response: 'hello' },
        { userId: STUDENT_ID, roles: ['student'], isGlobal: false }
      );
      assert.equal(out.id, SUBMISSION_ID);
      assert.equal(out.status, 'submitted');
      assert.equal(out.student_id, STUDENT_ID);
    } finally {
      assessmentsRepo.findById = originals.findById;
      enrollmentsRepo.findByCohortAndStudent = originals.findByCohortAndStudent;
      repo.findAnyFinalGrade = originals.findAnyFinalGrade;
      repo.findByAssessmentAndStudent = originals.findByAssessmentAndStudent;
      repo.create = originals.create;
      prisma.users.findMany = originals.users;
      delete require.cache[servicePath];
    }
  });

  it('updateSubmission still sets resubmitted on same row and does not create', async () => {
    const servicePath = require.resolve('../src/modules/submissions/submissions.service');
    const repoPath = require.resolve('../src/modules/submissions/submissions.repository');
    const { prisma } = require('../src/config/db');

    delete require.cache[servicePath];
    const repo = require(repoPath);
    const originals = {
      findById: repo.findById,
      findAnyFinalGrade: repo.findAnyFinalGrade,
      update: repo.update,
      create: repo.create,
      users: prisma.users.findMany,
    };

    let createCalled = false;
    let updatedId = null;
    repo.findById = async () => ({
      id: SUBMISSION_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      submission_type: 'text_response',
      file_url: null,
      repo_url: null,
      text_response: 'old',
      status: 'submitted',
      assessments: null,
    });
    repo.findAnyFinalGrade = async () => null;
    repo.create = async () => {
      createCalled = true;
      throw new Error('update must not create');
    };
    repo.update = async (id, data) => {
      updatedId = id;
      return {
        id,
        assessment_id: ASSESSMENT_ID,
        student_id: STUDENT_ID,
        submission_type: data.submission_type,
        file_url: data.file_url,
        repo_url: data.repo_url,
        text_response: data.text_response,
        status: data.status,
        assessments: null,
      };
    };
    prisma.users.findMany = async () => [];

    try {
      const service = require(servicePath);
      const out = await service.updateSubmission(
        SUBMISSION_ID,
        { text_response: 'new' },
        { userId: STUDENT_ID, roles: ['student'], isGlobal: false }
      );
      assert.equal(updatedId, SUBMISSION_ID);
      assert.equal(out.status, 'resubmitted');
      assert.equal(createCalled, false);
    } finally {
      repo.findById = originals.findById;
      repo.findAnyFinalGrade = originals.findAnyFinalGrade;
      repo.update = originals.update;
      repo.create = originals.create;
      prisma.users.findMany = originals.users;
      delete require.cache[servicePath];
    }
  });

  it('update remains blocked after final grade', async () => {
    const servicePath = require.resolve('../src/modules/submissions/submissions.service');
    const repoPath = require.resolve('../src/modules/submissions/submissions.repository');
    delete require.cache[servicePath];
    const repo = require(repoPath);
    const originals = {
      findById: repo.findById,
      findAnyFinalGrade: repo.findAnyFinalGrade,
    };
    repo.findById = async () => ({
      id: SUBMISSION_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      status: 'submitted',
      submission_type: 'text_response',
    });
    repo.findAnyFinalGrade = async () => ({ id: 'grade', is_final: true });
    try {
      const service = require(servicePath);
      await assert.rejects(
        () =>
          service.updateSubmission(
            SUBMISSION_ID,
            { text_response: 'x' },
            { userId: STUDENT_ID, roles: ['student'] }
          ),
        (err) => err.statusCode === 400
      );
    } finally {
      repo.findById = originals.findById;
      repo.findAnyFinalGrade = originals.findAnyFinalGrade;
      delete require.cache[servicePath];
    }
  });

  it('HTTP POST create requires auth; unauthorized cannot submit', async () => {
    const res = await request(app)
      .post(`/api/v1/assessments/${ASSESSMENT_ID}/submissions`)
      .send({ submission_type: 'text_response', text_response: 'x' });
    assert.equal(res.status, 401);
  });

  it('field-training modules do not import academic submissions.lifecycle', () => {
    const ftDir = path.join(__dirname, '..', 'src', 'modules', 'fieldTraining');
    for (const f of fs.readdirSync(ftDir).filter((n) => n.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(ftDir, f), 'utf8');
      assert.equal(/submissions\.lifecycle/.test(src), false, f);
    }
  });

  it('grades immutability lifecycle remains separate and present', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'grades', 'grades.lifecycle.js'),
      'utf8'
    );
    assert.match(src, /GRADE_FINALIZED/);
  });

  it('canonical key is assessment_id + student_id (not enrollment_id)', () => {
    const model = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');
    const block = model.slice(model.indexOf('model submissions'), model.indexOf('model system_settings'));
    assert.match(block, /assessment_id/);
    assert.match(block, /student_id/);
    assert.equal(/enrollment_id/.test(block), false);
    assert.equal(OTHER_STUDENT !== STUDENT_ID, true);
  });
});
