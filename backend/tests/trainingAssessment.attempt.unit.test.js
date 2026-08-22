'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isAttemptExpired,
  mapAttempt,
  orderQuestions,
} = require('../src/modules/trainingPrograms/trainingAssessment.service');

describe('isAttemptExpired', () => {
  it('expires IN_PROGRESS attempts past duration_minutes', () => {
    const started = new Date('2026-08-19T10:00:00.000Z');
    const now = new Date('2026-08-19T10:31:00.000Z');
    assert.equal(
      isAttemptExpired({ started_at: started, status: 'IN_PROGRESS' }, { duration_minutes: 30 }, now),
      true
    );
  });

  it('does not expire within the window', () => {
    const started = new Date('2026-08-19T10:00:00.000Z');
    const now = new Date('2026-08-19T10:10:00.000Z');
    assert.equal(
      isAttemptExpired({ started_at: started, status: 'IN_PROGRESS' }, { duration_minutes: 30 }, now),
      false
    );
  });
});

describe('mapAttempt show_results', () => {
  it('hides gradingDetails and score when show_results is false', () => {
    const mapped = mapAttempt(
      {
        id: 'a1',
        assessment_id: 'as1',
        enrollment_id: 'e1',
        attempt_no: 1,
        status: 'GRADED',
        answers_json: { answers: { q1: 'a' }, gradingDetails: [{ id: 'q1' }], maxScore: 10 },
        score: 80,
        started_at: new Date(),
        submitted_at: new Date(),
        graded_at: new Date(),
      },
      { showResults: false }
    );
    assert.equal(mapped.gradingDetails, undefined);
    assert.equal(mapped.score, null);
    assert.equal(mapped.maxScore, null);
  });
});

describe('orderQuestions', () => {
  it('applies a stored shuffle order', () => {
    const questions = [
      { id: 'q1', sort_order: 0 },
      { id: 'q2', sort_order: 1 },
      { id: 'q3', sort_order: 2 },
    ];
    const ordered = orderQuestions(questions, ['q3', 'q1', 'q2']);
    assert.deepEqual(
      ordered.map((q) => q.id),
      ['q3', 'q1', 'q2']
    );
  });
});
