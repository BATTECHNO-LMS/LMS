'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_MARK,
  MAX_MARK,
  markFromSubmissionId,
  toStoredScores,
  classifySubmission,
  wasPreviouslyGraded,
  expelledBeforeSubmitting,
} = require('../scripts/lib/gradeFieldTrainingTaskSubmissions');

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('field training task score hash', () => {
  it('returns a deterministic integer between 80 and 90 inclusive', () => {
    const first = markFromSubmissionId(ID_A);
    const second = markFromSubmissionId(ID_A);
    assert.equal(first, second);
    assert.ok(first >= MIN_MARK && first <= MAX_MARK);
    assert.equal(Number.isInteger(first), true);
  });

  it('spreads marks across the 80–90 range for distinct ids', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i += 1) {
      const id = `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`;
      const mark = markFromSubmissionId(id);
      assert.ok(mark >= 80 && mark <= 90);
      seen.add(mark);
    }
    assert.equal(seen.size, 11);
  });

  it('stores percentage out of 100 when max_score is missing or 100', () => {
    assert.deepEqual(toStoredScores(87, null), { manual_score: 87, max_score: 100, percent: 87 });
    assert.deepEqual(toStoredScores(81, 100), { manual_score: 81, max_score: 100, percent: 81 });
  });

  it('converts percentage to raw points and never exceeds task max', () => {
    const stored = toStoredScores(90, 20);
    assert.equal(stored.max_score, 20);
    assert.equal(stored.manual_score, 18);
    assert.ok(stored.manual_score <= 20);
    const capped = toStoredScores(90, 10);
    assert.equal(capped.manual_score, 9);
  });
});

describe('field training task grade eligibility', () => {
  it('excludes cancelled, incomplete, orphan, and pre-submit expulsion rows', () => {
    assert.equal(
      classifySubmission({
        id: ID_A,
        task_id: ID_A,
        application_id: ID_A,
        student_id: ID_A,
        submitted_at: new Date(),
        file_path: 'a.pdf',
        field_training_tasks: { id: ID_A },
        field_training_applications: { status: 'cancelled' },
      }).reason,
      'cancelled_application'
    );
    assert.equal(
      classifySubmission({
        id: ID_A,
        task_id: ID_A,
        application_id: ID_A,
        student_id: ID_A,
        submitted_at: new Date(),
        field_training_tasks: { id: ID_A },
        field_training_applications: { status: 'approved' },
      }).reason,
      'no_actual_submission'
    );
    assert.equal(classifySubmission({ id: ID_A }).reason, 'invalid_orphan');
    assert.equal(
      expelledBeforeSubmitting(
        { training_status: 'expelled', expelled_at: '2026-01-01T00:00:00.000Z' },
        '2026-02-01T00:00:00.000Z'
      ),
      true
    );
    assert.equal(
      expelledBeforeSubmitting(
        { training_status: 'expelled', expelled_at: '2026-03-01T00:00:00.000Z' },
        '2026-02-01T00:00:00.000Z'
      ),
      false
    );
  });

  it('includes a real file submission on an approved application', () => {
    const verdict = classifySubmission({
      id: ID_B,
      task_id: ID_A,
      application_id: ID_A,
      student_id: ID_A,
      submitted_at: new Date(),
      file_path: 'field-training/task/file.pdf',
      review_status: 'pending',
      field_training_tasks: { id: ID_A },
      field_training_applications: { status: 'approved', training_status: 'task_submitted' },
    });
    assert.equal(verdict.eligible, true);
  });

  it('detects previously graded rows that must be overwritten', () => {
    assert.equal(wasPreviouslyGraded({ manual_score: 70, review_status: 'graded' }), true);
    assert.equal(wasPreviouslyGraded({ manual_score: null, review_status: 'pending' }), false);
  });
});
