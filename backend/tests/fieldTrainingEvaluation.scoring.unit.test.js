'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFinalEvaluation,
  validatePolicyWeights,
  mapAttendanceBand,
  supervisorRatingsComplete,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');
const { GATE_REASONS, FINAL_STATUS } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');

const fullRatings = {
  thinkingAndInitiative: 5,
  problemSolving: 5,
  teamwork: 5,
  professionalConduct: 5,
  supervisorCooperation: 5,
  rulesCompliance: 5,
};

function perfectInput(overrides = {}) {
  return {
    attendancePercentage: 100,
    completedHours: 120,
    requiredHours: 120,
    requiredTaskCount: 4,
    acceptedTaskCount: 4,
    rejectedTaskCount: 0,
    taskScoreAveragePercent: 95,
    preAssessmentScore: 58,
    postAssessmentScore: 84,
    supervisorRatings: fullRatings,
    ...overrides,
  };
}

describe('field training auto-evaluation scoring', () => {
  it('scores a perfect student as PASSED with 50/50 professional and ~100 final', () => {
    const result = calculateFinalEvaluation(perfectInput());
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
    assert.equal(result.finalStatus, FINAL_STATUS.PASSED);
    assert.equal(result.professionalTotal, 50);
    assert.equal(result.professionalPercentage, 100);
    assert.ok(result.finalScore >= 95);
    assert.equal(result.criterion5Score, 5);
    assert.equal(result.criterion9Score, 5);
    assert.equal(result.improvementPercentage, 26);
  });

  it('passes an eligible strong student', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        attendancePercentage: 96,
        postAssessmentScore: 80,
        supervisorRatings: { ...fullRatings, teamwork: 4, professionalConduct: 4 },
      })
    );
    assert.equal(result.finalStatus, FINAL_STATUS.PASSED);
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
  });

  it('fails an eligible student below the pass score without treating them as NOT_ELIGIBLE', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        attendancePercentage: 82,
        acceptedTaskCount: 3,
        requiredTaskCount: 4,
        taskScoreAveragePercent: 50,
        postAssessmentScore: 50,
        supervisorRatings: {
          thinkingAndInitiative: 2,
          problemSolving: 2,
          teamwork: 2,
          professionalConduct: 2,
          supervisorCooperation: 2,
          rulesCompliance: 2,
        },
      }),
      { minimumPassingScore: 70, requiredTasksRequired: false }
    );
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
    assert.equal(result.finalStatus, FINAL_STATUS.FAILED);
    assert.ok(result.finalScore < 70);
  });

  it('marks attendance below requirement as NOT_ELIGIBLE, not FAILED', () => {
    const result = calculateFinalEvaluation(perfectInput({ attendancePercentage: 70 }), {
      minimumAttendancePercentage: 80,
    });
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED));
  });

  it('marks missing required hours as NOT_ELIGIBLE', () => {
    const result = calculateFinalEvaluation(perfectInput({ completedHours: 40, requiredHours: 120 }));
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED));
  });

  it('marks missing required submission as NOT_ELIGIBLE', () => {
    const result = calculateFinalEvaluation(perfectInput({ acceptedTaskCount: 1, requiredTaskCount: 4 }));
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_SUBMISSION_MISSING));
  });

  it('marks missing post-assessment as NOT_ELIGIBLE', () => {
    const result = calculateFinalEvaluation(perfectInput({ postAssessmentScore: null }));
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED));
  });

  it('marks missing behavioral ratings as PROFESSIONAL_EVALUATION_INCOMPLETE', () => {
    const result = calculateFinalEvaluation(perfectInput({ supervisorRatings: null }));
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.PROFESSIONAL_EVALUATION_INCOMPLETE));
    assert.equal(result.criterion3Score, null);
    assert.equal(result.professionalTotal, null);
  });

  it('does not auto-award 5/5 when behavioral evidence is missing', () => {
    const result = calculateFinalEvaluation(perfectInput({ supervisorRatings: {} }));
    assert.notEqual(result.criterion3Score, 5);
    assert.equal(result.criterion3Score, null);
  });

  it('applies different university weights and pass scores', () => {
    const policy = {
      attendanceWeight: 10,
      tasksWeight: 10,
      postAssessmentWeight: 10,
      professionalEvaluationWeight: 70,
      minimumPassingScore: 90,
    };
    assert.equal(validatePolicyWeights(policy).ok, true);
    const result = calculateFinalEvaluation(
      perfectInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        supervisorRatings: {
          thinkingAndInitiative: 3,
          problemSolving: 3,
          teamwork: 3,
          professionalConduct: 3,
          supervisorCooperation: 3,
          rulesCompliance: 3,
        },
      }),
      policy
    );
    assert.equal(result.finalStatus, FINAL_STATUS.FAILED);
    assert.ok(result.finalScore < 90);
  });

  it('rejects weights that do not total 100', () => {
    const check = validatePolicyWeights({
      attendanceWeight: 20,
      tasksWeight: 20,
      postAssessmentWeight: 20,
      professionalEvaluationWeight: 20,
    });
    assert.equal(check.ok, false);
    assert.equal(check.total, 80);
  });

  it('maps default attendance bands and totals 10 criteria /50', () => {
    assert.equal(mapAttendanceBand(99), 5);
    assert.equal(mapAttendanceBand(96), 4);
    assert.equal(mapAttendanceBand(92), 3);
    assert.equal(mapAttendanceBand(85), 2);
    assert.equal(mapAttendanceBand(50), 1);
    const result = calculateFinalEvaluation(perfectInput());
    const sum =
      result.criterion1Score +
      result.criterion2Score +
      result.criterion3Score +
      result.criterion4Score +
      result.criterion5Score +
      result.criterion6Score +
      result.criterion7Score +
      result.criterion8Score +
      result.criterion9Score +
      result.criterion10Score;
    assert.equal(sum, result.professionalTotal);
    assert.equal(result.professionalTotal, 50);
  });

  it('builds deterministic Arabic comments without inventing a pass for ineligible students', () => {
    const ineligible = calculateFinalEvaluation(perfectInput({ completedHours: 0, requiredHours: 100 }));
    const text = buildAutoComment(ineligible);
    assert.match(text, /الأهلية/);
    assert.equal(ineligible.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
    const passed = buildAutoComment(calculateFinalEvaluation(perfectInput()));
    assert.ok(passed.length > 20);
    assert.doesNotMatch(passed, /undefined|null/i);
  });

  it('requires complete supervisor ratings', () => {
    assert.equal(supervisorRatingsComplete(fullRatings), true);
    assert.equal(supervisorRatingsComplete({ ...fullRatings, teamwork: null }), false);
  });
});
