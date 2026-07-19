'use strict';

/**
 * ACADEMIC-GRADE-001: finalized academic grade immutability (database-free).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');

const {
  GRADE_FINALIZED,
  FINALIZED_IMMUTABLE_MESSAGE,
  isGradeFinal,
  assertGradeMutable,
  assertNoFinalizedGradeOverwrite,
  assertGradeScoreInRange,
} = require('../src/modules/grades/grades.lifecycle');
const { ApiError } = require('../src/utils/apiError');

const GRADE_ID = '55555555-5555-4555-8555-555555555555';
const ASSESSMENT_ID = '66666666-6666-4666-8666-666666666666';
const STUDENT_ID = '77777777-7777-4777-8777-777777777777';

describe('ACADEMIC-GRADE-001 finalized grade immutability', () => {
  it('isGradeFinal reflects is_final only', () => {
    assert.equal(isGradeFinal({ is_final: true }), true);
    assert.equal(isGradeFinal({ is_final: false }), false);
    assert.equal(isGradeFinal(null), false);
  });

  it('assertGradeMutable allows non-final grades', () => {
    assert.doesNotThrow(() => assertGradeMutable({ is_final: false, score: 80 }));
  });

  it('assertGradeMutable rejects finalized grades with 409 GRADE_FINALIZED', () => {
    assert.throws(
      () => assertGradeMutable({ is_final: true, score: 90, feedback: 'ok' }),
      (err) =>
        err instanceof ApiError &&
        err.statusCode === 409 &&
        err.code === GRADE_FINALIZED &&
        err.message === FINALIZED_IMMUTABLE_MESSAGE
    );
  });

  it('partial intent does not matter: any mutation attempt against final is rejected by the guard', () => {
    // Guard is content-agnostic; callers invoke it before applying score/feedback/body.
    assert.throws(() => assertGradeMutable({ is_final: true }), (e) => e.code === GRADE_FINALIZED);
  });

  it('assertNoFinalizedGradeOverwrite blocks create-path overwrite of finals', () => {
    assert.throws(
      () => assertNoFinalizedGradeOverwrite({ id: GRADE_ID, is_final: true }),
      (err) => err.statusCode === 409 && err.code === GRADE_FINALIZED
    );
    assert.doesNotThrow(() => assertNoFinalizedGradeOverwrite(null));
  });

  it('assertGradeScoreInRange enforces 0–100 (finalize safety)', () => {
    assert.equal(assertGradeScoreInRange(0), 0);
    assert.equal(assertGradeScoreInRange(100), 100);
    assert.throws(() => assertGradeScoreInRange(101), (e) => e.statusCode === 400);
    assert.throws(() => assertGradeScoreInRange(-1), (e) => e.statusCode === 400);
    assert.throws(() => assertGradeScoreInRange('x'), (e) => e.statusCode === 400);
  });

  it('updateGrade invokes mutability guard before repo.update (service contract)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'grades', 'grades.service.js'),
      'utf8'
    );
    assert.match(src, /assertGradeMutable\(row\)/);
    assert.match(src, /assertNoFinalizedGradeOverwrite\(existingFinal\)/);
    assert.match(src, /isGradeFinal\(row\)/);
    // Former overwrite of existing final via create must be gone
    assert.equal(/wantFinal && existingFinal[\s\S]*repo\.update\(existingFinal\.id/.test(src), false);
  });

  it('repository unfinalize helper refuses to clear is_final', async () => {
    const repo = require('../src/modules/grades/grades.repository');
    await assert.rejects(
      () => repo.setAllNonFinalForPair(ASSESSMENT_ID, STUDENT_ID),
      (err) => err.statusCode === 409 && err.code === GRADE_FINALIZED
    );
  });

  it('direct service updateGrade rejects finalized grade without calling repo.update', async () => {
    const gradesServicePath = require.resolve('../src/modules/grades/grades.service');
    const repoPath = require.resolve('../src/modules/grades/grades.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const assessmentsServicePath = require.resolve('../src/modules/assessments/assessments.service');

    // Isolate module graph for this invocation
    delete require.cache[gradesServicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const assessmentsService = require(assessmentsServicePath);

    const originalFindById = repo.findById;
    const originalUpdate = repo.update;
    const originalAssessFind = assessmentsRepo.findById;
    const originalAssertWrite = assessmentsService.assertCanWriteAssessment;

    let updateCalled = false;
    repo.findById = async () => ({
      id: GRADE_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      grader_id: STUDENT_ID,
      score: 88,
      feedback: 'locked',
      is_final: true,
      graded_at: new Date(),
      assessments: null,
    });
    repo.update = async () => {
      updateCalled = true;
      throw new Error('repo.update must not be called for finalized grades');
    };
    assessmentsRepo.findById = async () => ({ id: ASSESSMENT_ID, cohort_id: ASSESSMENT_ID });
    assessmentsService.assertCanWriteAssessment = async () => {};

    try {
      const gradesService = require(gradesServicePath);
      await assert.rejects(
        () =>
          gradesService.updateGrade(
            GRADE_ID,
            { score: 10, feedback: 'hack' },
            { userId: STUDENT_ID, roles: ['instructor'], isGlobal: false }
          ),
        (err) => err.statusCode === 409 && err.code === GRADE_FINALIZED
      );
      assert.equal(updateCalled, false);
    } finally {
      repo.findById = originalFindById;
      repo.update = originalUpdate;
      assessmentsRepo.findById = originalAssessFind;
      assessmentsService.assertCanWriteAssessment = originalAssertWrite;
      delete require.cache[gradesServicePath];
    }
  });

  it('direct service updateGrade allows non-final grade updates', async () => {
    const gradesServicePath = require.resolve('../src/modules/grades/grades.service');
    const repoPath = require.resolve('../src/modules/grades/grades.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const assessmentsServicePath = require.resolve('../src/modules/assessments/assessments.service');

    delete require.cache[gradesServicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const assessmentsService = require(assessmentsServicePath);

    const originalFindById = repo.findById;
    const originalUpdate = repo.update;
    const originalAssessFind = assessmentsRepo.findById;
    const originalAssertWrite = assessmentsService.assertCanWriteAssessment;

    repo.findById = async () => ({
      id: GRADE_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      grader_id: STUDENT_ID,
      score: 70,
      feedback: 'draft',
      is_final: false,
      graded_at: new Date(),
      assessments: null,
    });
    repo.update = async (_id, data) => ({
      id: GRADE_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      grader_id: STUDENT_ID,
      score: data.score,
      feedback: data.feedback,
      is_final: false,
      graded_at: new Date(),
      assessments: null,
    });
    assessmentsRepo.findById = async () => ({ id: ASSESSMENT_ID, cohort_id: ASSESSMENT_ID });
    assessmentsService.assertCanWriteAssessment = async () => {};

    // prisma.users.findMany used by load maps — stub via mock if needed
    const { prisma } = require('../src/config/db');
    const originalUsers = prisma.users.findMany;
    prisma.users.findMany = async () => [];

    try {
      const gradesService = require(gradesServicePath);
      const out = await gradesService.updateGrade(
        GRADE_ID,
        { score: 75, feedback: 'improved' },
        { userId: STUDENT_ID, roles: ['instructor'], isGlobal: false }
      );
      assert.equal(out.score, 75);
      assert.equal(out.feedback, 'improved');
      assert.equal(out.is_final, false);
    } finally {
      repo.findById = originalFindById;
      repo.update = originalUpdate;
      assessmentsRepo.findById = originalAssessFind;
      assessmentsService.assertCanWriteAssessment = originalAssertWrite;
      prisma.users.findMany = originalUsers;
      delete require.cache[gradesServicePath];
    }
  });

  it('finalizeGrade is idempotent for already-final grades (no delete/update)', async () => {
    const gradesServicePath = require.resolve('../src/modules/grades/grades.service');
    const repoPath = require.resolve('../src/modules/grades/grades.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const assessmentsServicePath = require.resolve('../src/modules/assessments/assessments.service');
    const { prisma } = require('../src/config/db');

    delete require.cache[gradesServicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const assessmentsService = require(assessmentsServicePath);

    const originalFindById = repo.findById;
    const originalAssessFind = assessmentsRepo.findById;
    const originalAssertWrite = assessmentsService.assertCanWriteAssessment;
    const originalTx = prisma.$transaction;
    const originalUsers = prisma.users.findMany;

    let txCalled = false;
    repo.findById = async () => ({
      id: GRADE_ID,
      assessment_id: ASSESSMENT_ID,
      student_id: STUDENT_ID,
      grader_id: STUDENT_ID,
      score: 91,
      feedback: 'done',
      is_final: true,
      graded_at: new Date(),
      assessments: null,
    });
    assessmentsRepo.findById = async () => ({ id: ASSESSMENT_ID, cohort_id: ASSESSMENT_ID });
    assessmentsService.assertCanWriteAssessment = async () => {};
    prisma.$transaction = async () => {
      txCalled = true;
      throw new Error('transaction must not run for idempotent finalize');
    };
    prisma.users.findMany = async () => [];

    try {
      const gradesService = require(gradesServicePath);
      const out = await gradesService.finalizeGrade(GRADE_ID, {
        userId: STUDENT_ID,
        roles: ['academic_admin'],
        isGlobal: false,
      });
      assert.equal(out.is_final, true);
      assert.equal(out.score, 91);
      assert.equal(txCalled, false);
    } finally {
      repo.findById = originalFindById;
      assessmentsRepo.findById = originalAssessFind;
      assessmentsService.assertCanWriteAssessment = originalAssertWrite;
      prisma.$transaction = originalTx;
      prisma.users.findMany = originalUsers;
      delete require.cache[gradesServicePath];
    }
  });

  it('direct service createGradeForAssessment rejects overwrite of existing final', async () => {
    const gradesServicePath = require.resolve('../src/modules/grades/grades.service');
    const repoPath = require.resolve('../src/modules/grades/grades.repository');
    const assessmentsRepoPath = require.resolve('../src/modules/assessments/assessments.repository');
    const assessmentsServicePath = require.resolve('../src/modules/assessments/assessments.service');
    const enrollmentsRepoPath = require.resolve('../src/modules/enrollments/enrollments.repository');
    const { prisma } = require('../src/config/db');

    delete require.cache[gradesServicePath];

    const repo = require(repoPath);
    const assessmentsRepo = require(assessmentsRepoPath);
    const assessmentsService = require(assessmentsServicePath);
    const enrollmentsRepo = require(enrollmentsRepoPath);

    const originalAssessFind = assessmentsRepo.findById;
    const originalAssertWrite = assessmentsService.assertCanWriteAssessment;
    const originalEnroll = enrollmentsRepo.findByCohortAndStudent;
    const originalCount = repo.countSubmissionsForStudent;
    const originalUpdate = repo.update;
    const originalFindFirst = prisma.grades.findFirst;

    let updateCalled = false;
    assessmentsRepo.findById = async () => ({ id: ASSESSMENT_ID, cohort_id: ASSESSMENT_ID });
    assessmentsService.assertCanWriteAssessment = async () => {};
    enrollmentsRepo.findByCohortAndStudent = async () => ({ enrollment_status: 'enrolled' });
    repo.countSubmissionsForStudent = async () => 1;
    repo.update = async () => {
      updateCalled = true;
      throw new Error('must not update finalized grade via create');
    };
    prisma.grades.findFirst = async () => ({ id: GRADE_ID, is_final: true });

    try {
      const gradesService = require(gradesServicePath);
      await assert.rejects(
        () =>
          gradesService.createGradeForAssessment(
            ASSESSMENT_ID,
            { student_id: STUDENT_ID, score: 50, feedback: 'nope', is_final: true },
            { userId: STUDENT_ID, roles: ['super_admin'], isGlobal: true }
          ),
        (err) => err.statusCode === 409 && err.code === GRADE_FINALIZED
      );
      assert.equal(updateCalled, false);
    } finally {
      assessmentsRepo.findById = originalAssessFind;
      assessmentsService.assertCanWriteAssessment = originalAssertWrite;
      enrollmentsRepo.findByCohortAndStudent = originalEnroll;
      repo.countSubmissionsForStudent = originalCount;
      repo.update = originalUpdate;
      prisma.grades.findFirst = originalFindFirst;
      delete require.cache[gradesServicePath];
    }
  });

  it('HTTP PUT /grades/:id requires auth (route cannot bypass service)', async () => {
    const res = await request(app).put(`/api/v1/grades/${GRADE_ID}`).send({ score: 1 });
    assert.equal(res.status, 401);
  });

  it('HTTP PATCH finalize requires auth', async () => {
    const res = await request(app).patch(`/api/v1/grades/${GRADE_ID}/finalize`);
    assert.equal(res.status, 401);
  });

  it('field-training modules do not import academic grades.lifecycle', () => {
    const ftDir = path.join(__dirname, '..', 'src', 'modules', 'fieldTraining');
    const files = fs.readdirSync(ftDir).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const src = fs.readFileSync(path.join(ftDir, f), 'utf8');
      assert.equal(/grades\.lifecycle/.test(src), false, f);
    }
  });

  it('academic submissions service is unchanged regarding grade final lock messaging', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'submissions', 'submissions.service.js'),
      'utf8'
    );
    assert.match(src, /Cannot modify submission after final grade/);
    assert.match(src, /late \? 'late' : 'submitted'/);
  });

  it('roles are not exempted in lifecycle guard (no super_admin bypass)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'grades', 'grades.lifecycle.js'),
      'utf8'
    );
    assert.match(src, /function assertGradeMutable\(grade\)/);
    assert.equal(/function assertGradeMutable\([^)]*requester/.test(src), false);
    assert.equal(/isGlobal/.test(src), false);
    const serviceSrc = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'modules', 'grades', 'grades.service.js'),
      'utf8'
    );
    assert.match(serviceSrc, /including super_admin/);
  });
});
