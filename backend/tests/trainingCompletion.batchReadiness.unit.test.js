'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildProgressRequirements } = require('../src/modules/trainingPrograms/trainingProgress.helpers');
const {
  deriveCompletionEligibility,
  eligibilityFromSnapshot,
} = require('../src/modules/trainingPrograms/trainingCompletion.service');

function program(overrides = {}) {
  return { required_hours: 10, required_attendance_pct: 80, ...overrides };
}

function requiredTasks() {
  return [{ id: 'task-1' }, { id: 'task-2' }];
}

function reqRows(overrides = {}) {
  return [
    { code: 'TASKS', is_required: true, threshold_json: {} },
    { code: 'PRE_TEST', is_required: false, threshold_json: {} },
    { code: 'POST_TEST', is_required: true, threshold_json: { pass_score: 60 } },
    { code: 'FINAL_TASK', is_required: false, threshold_json: {} },
    { code: 'EVALUATION', is_required: true, threshold_json: {} },
    ...Object.entries(overrides).map(([code, rest]) => ({ code, ...rest })),
  ];
}

function sessions() {
  return [
    { id: 's1', hours: 5, starts_at: null, ends_at: null, cohort_id: 'c1' },
    { id: 's2', hours: 5, starts_at: null, ends_at: null, cohort_id: 'c1' },
  ];
}

describe('batched completion readiness matches sequential snapshot semantics', () => {
  it('eligible trainee: batched snapshot produces READY_TO_COMPLETE', () => {
    const snapshot = buildProgressRequirements({
      program: program(),
      sessions: sessions(),
      attendance: [
        { session_id: 's1', status: 'present' },
        { session_id: 's2', status: 'late' },
      ],
      requiredTasks: requiredTasks(),
      submissions: [
        { task_id: 'task-1', score: 90, submitted_at: new Date() },
        { task_id: 'task-2', score: 88, submitted_at: new Date() },
      ],
      reqRows: reqRows(),
      assessments: [
        {
          id: 'post',
          kind: 'POST_TEST',
          pass_score: 60,
          training_assessment_attempts: [{ status: 'GRADED', score: 80, graded_at: new Date() }],
        },
      ],
      finalTaskRow: null,
      evaluationAssignment: { status: 'SUBMITTED' },
    });
    assert.equal(snapshot.allOk, true);
    assert.equal(snapshot.completionPct, 100);
    const derived = deriveCompletionEligibility('ACTIVE', snapshot.requirements);
    assert.equal(derived.eligible, true);
    assert.equal(derived.lifecycleStatus, 'READY_TO_COMPLETE');
    const fromSnap = eligibilityFromSnapshot({ id: 'e1', status: 'ACTIVE' }, snapshot);
    assert.equal(fromSnap.eligible, derived.eligible);
    assert.deepEqual(fromSnap.missingRequirements, derived.missingRequirements);
    assert.equal(fromSnap.lifecycleStatus, derived.lifecycleStatus);
  });

  it('missing post-test: batched snapshot stays POST_TEST_PENDING', () => {
    const snapshot = buildProgressRequirements({
      program: program(),
      sessions: sessions(),
      attendance: [
        { session_id: 's1', status: 'present' },
        { session_id: 's2', status: 'present' },
      ],
      requiredTasks: requiredTasks(),
      submissions: [
        { task_id: 'task-1', submitted_at: new Date() },
        { task_id: 'task-2', submitted_at: new Date() },
      ],
      reqRows: reqRows(),
      assessments: [{ id: 'post', kind: 'POST_TEST', pass_score: 60, training_assessment_attempts: [] }],
      finalTaskRow: null,
      evaluationAssignment: { status: 'LOCKED' },
    });
    assert.equal(snapshot.requirements.postTest.ok, false);
    const derived = deriveCompletionEligibility('ACTIVE', snapshot.requirements);
    assert.equal(derived.eligible, false);
    assert.equal(derived.lifecycleStatus, 'POST_TEST_PENDING');
    assert.ok(derived.missingRequirements.includes('postTest'));
  });

  it('two enrollments sharing program data produce independent results', () => {
    const shared = {
      program: program(),
      requiredTasks: requiredTasks(),
      reqRows: reqRows(),
      sessions: sessions(),
      assessments: [{ id: 'post', kind: 'POST_TEST', pass_score: 60 }],
      finalTaskRow: null,
    };
    const ready = buildProgressRequirements({
      ...shared,
      attendance: [
        { session_id: 's1', status: 'present' },
        { session_id: 's2', status: 'present' },
      ],
      submissions: [
        { task_id: 'task-1', submitted_at: new Date() },
        { task_id: 'task-2', submitted_at: new Date() },
      ],
      assessments: [
        {
          id: 'post',
          kind: 'POST_TEST',
          pass_score: 60,
          training_assessment_attempts: [{ status: 'GRADED', score: 90, graded_at: new Date() }],
        },
      ],
      evaluationAssignment: { status: 'SUBMITTED' },
    });
    const notReady = buildProgressRequirements({
      ...shared,
      attendance: [{ session_id: 's1', status: 'absent' }],
      submissions: [],
      assessments: [{ id: 'post', kind: 'POST_TEST', pass_score: 60, training_assessment_attempts: [] }],
      evaluationAssignment: { status: 'LOCKED' },
    });
    assert.equal(ready.allOk, true);
    assert.equal(notReady.allOk, false);
    assert.equal(eligibilityFromSnapshot({ id: 'a', status: 'ACTIVE' }, ready).eligible, true);
    assert.equal(eligibilityFromSnapshot({ id: 'b', status: 'ACTIVE' }, notReady).eligible, false);
  });

  it('COMPLETED enrollment stays COMPLETED even when requirements are met', () => {
    const snapshot = buildProgressRequirements({
      program: program({ required_hours: 0, required_attendance_pct: 0 }),
      sessions: [],
      attendance: [],
      requiredTasks: [],
      submissions: [],
      reqRows: [
        { code: 'TASKS', is_required: false, threshold_json: {} },
        { code: 'PRE_TEST', is_required: false, threshold_json: {} },
        { code: 'POST_TEST', is_required: false, threshold_json: {} },
        { code: 'FINAL_TASK', is_required: false, threshold_json: {} },
        { code: 'EVALUATION', is_required: false, threshold_json: {} },
      ],
      assessments: [],
      finalTaskRow: null,
      evaluationAssignment: null,
    });
    const derived = deriveCompletionEligibility('COMPLETED', snapshot.requirements);
    assert.equal(derived.lifecycleStatus, 'COMPLETED');
    assert.equal(derived.eligible, true);
  });
});
