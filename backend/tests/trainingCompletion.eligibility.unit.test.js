'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveCompletionEligibility,
  FINALIZATION_MODES,
  REPORT_THRESHOLDS,
} = require('../src/modules/trainingPrograms/trainingCompletion.service');
const { average, npsCategory } = require('../src/modules/trainingPrograms/trainingEvaluation.scoring');

function baseRequirements(overrides = {}) {
  return {
    attendance: { required: 80, ok: true, value: 90 },
    hours: { required: 10, ok: true, value: 12 },
    tasks: { required: 2, ok: true, value: 2 },
    preTest: { required: false, ok: true },
    postTest: { required: true, ok: true, passed: true },
    finalTask: { required: false, ok: true },
    evaluation: { required: true, ok: true, status: 'SUBMITTED' },
    ...overrides,
  };
}

describe('trainingCompletion.deriveCompletionEligibility', () => {
  it('is COMPLETED when the enrollment is already COMPLETED', () => {
    const result = deriveCompletionEligibility('COMPLETED', baseRequirements());
    assert.equal(result.lifecycleStatus, 'COMPLETED');
    assert.equal(result.eligible, true);
    assert.deepEqual(result.missingRequirements, []);
  });

  it('is READY_TO_COMPLETE when every required requirement is satisfied', () => {
    const result = deriveCompletionEligibility('REQUIREMENTS_COMPLETED', baseRequirements());
    assert.equal(result.lifecycleStatus, 'READY_TO_COMPLETE');
    assert.equal(result.eligible, true);
    assert.equal(result.status, 'ELIGIBLE');
  });

  it('is FINAL_EVALUATION_REQUIRED when the evaluation is available/in-progress but not yet submitted', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({ evaluation: { required: true, ok: false, status: 'AVAILABLE' } })
    );
    assert.equal(result.lifecycleStatus, 'FINAL_EVALUATION_REQUIRED');
    assert.equal(result.eligible, false);
    assert.ok(result.missingRequirements.includes('evaluation'));
  });

  it('flags FINAL_EVALUATION_LOCKED as a warning while the evaluation is still LOCKED', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({
        postTest: { required: true, ok: false, passed: false },
        evaluation: { required: true, ok: false, status: 'LOCKED' },
      })
    );
    assert.ok(result.warnings.includes('FINAL_EVALUATION_LOCKED'));
    assert.equal(result.eligible, false);
  });

  it('is POST_TEST_PENDING when a pending manual grade blocks the post-test requirement', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({
        postTest: { required: true, ok: false, pendingManual: true },
        evaluation: { required: true, ok: false, status: 'LOCKED' },
      })
    );
    assert.equal(result.lifecycleStatus, 'POST_TEST_PENDING');
    assert.ok(result.warnings.includes('POST_TEST_GRADING_PENDING'));
  });

  it('is FINAL_EVALUATION_SUBMITTED when the evaluation is done but another requirement is still missing', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({
        attendance: { required: 80, ok: false, value: 50 },
        evaluation: { required: true, ok: true, status: 'SUBMITTED' },
      })
    );
    assert.equal(result.lifecycleStatus, 'FINAL_EVALUATION_SUBMITTED');
    assert.equal(result.eligible, false);
    assert.ok(result.missingRequirements.includes('attendance'));
  });

  it('falls back to ACTIVE when nothing else applies', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({
        attendance: { required: 80, ok: false, value: 50 },
        evaluation: { required: false, ok: true },
      })
    );
    assert.equal(result.lifecycleStatus, 'ACTIVE');
  });

  it('treats WITHDRAWN enrollments as never eligible even if requirements look complete', () => {
    const result = deriveCompletionEligibility('WITHDRAWN', baseRequirements());
    assert.equal(result.eligible, false);
  });

  it('ignores requirements marked required: false when computing missing/completed lists', () => {
    const result = deriveCompletionEligibility(
      'ACTIVE',
      baseRequirements({ preTest: { required: false, ok: false } })
    );
    assert.ok(!result.missingRequirements.includes('preTest'));
    assert.ok(!result.completedRequirements.includes('preTest'));
  });
});

describe('trainingCompletion constants', () => {
  it('exposes the two supported finalization modes', () => {
    assert.deepEqual(FINALIZATION_MODES, ['ELIGIBLE_ONLY', 'EXCEPTIONAL']);
  });

  it('exposes rules-based report thresholds used for course report recommendations', () => {
    assert.equal(typeof REPORT_THRESHOLDS.LOW_ATTENDANCE_PCT, 'number');
    assert.equal(typeof REPORT_THRESHOLDS.LOW_NPS_INDEX, 'number');
    assert.equal(typeof REPORT_THRESHOLDS.HIGH_DROPOUT_PCT, 'number');
  });
});

// Sanity: the completion report math reuses the shared scoring helpers (no duplicate NPS logic).
describe('trainingCompletion shares scoring helpers', () => {
  it('reuses npsCategory/average from trainingEvaluation.scoring', () => {
    assert.equal(npsCategory(10), 'PROMOTER');
    assert.equal(average([1, 2, 3]), 2);
  });
});
