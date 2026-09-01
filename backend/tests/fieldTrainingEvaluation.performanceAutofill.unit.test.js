'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFinalEvaluation,
  score100ToFivePoint,
  renormalizeWeightedAverage,
  mapPercentToFive,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');
const { buildFieldTrainingStudentPerformanceSnapshot } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.performanceSnapshot');
const { SCORE_SOURCE, GATE_REASONS, FINAL_STATUS } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const { classifyEvaluationReadiness } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.readiness');
const { buildAutoComment } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.comments');
const { summarizeAttendance, buildFieldTrainingEvaluationTemplatePayload } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');

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
    completedHours: 140,
    requiredHours: 140,
    requiredTaskCount: 4,
    acceptedTaskCount: 4,
    rejectedTaskCount: 0,
    taskScoreAveragePercent: 95,
    preAssessmentScore: 58,
    postAssessmentScore: 84,
    onTimeTaskCount: 4,
    requiredSubmissionCount: 4,
    hoursDataLoaded: true,
    attendanceDataLoaded: true,
    supervisorRatings: fullRatings,
    ...overrides,
  };
}

describe('field training performance autofill', () => {
  it('maps 0–100 to 1–5 using centralized thresholds', () => {
    assert.equal(score100ToFivePoint(95), 5);
    assert.equal(score100ToFivePoint(85), 4);
    assert.equal(score100ToFivePoint(75), 3);
    assert.equal(score100ToFivePoint(65), 2);
    assert.equal(score100ToFivePoint(40), 1);
    assert.equal(score100ToFivePoint(null), null);
  });

  it('renormalizes optional missing components instead of treating them as zero', () => {
    const avg = renormalizeWeightedAverage([
      { value: 80, weight: 40 },
      { value: 90, weight: 40 },
      { value: null, weight: 20 },
    ]);
    assert.equal(avg, 85);
  });

  it('builds one performance snapshot with null-safe hours', () => {
    const snapshot = buildFieldTrainingStudentPerformanceSnapshot({
      completedHours: null,
      requiredHours: 140,
      requiredTaskCount: 4,
      acceptedTaskCount: 2,
    });
    assert.equal(snapshot.completedTrainingHours, null);
    assert.equal(snapshot.hoursCompletionPercentage, null);
    assert.equal(snapshot.metrics.hoursMetric, null);
  });

  it('auto-derives criteria 1,2,5,9 from strong performance without supervisor ratings for those', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        supervisorRatings: {
          thinkingAndInitiative: 4,
          problemSolving: 4,
          teamwork: 4,
          professionalConduct: 4,
          supervisorCooperation: 4,
          rulesCompliance: 4,
        },
      })
    );
    assert.ok(result.criterion1Score >= 4);
    assert.ok(result.criterion2Score >= 4);
    assert.equal(result.criterion5Score, 5);
    assert.equal(result.criterion9Score, 5);
    assert.equal(result.criterionEvidence.criterion1.source, SCORE_SOURCE.DERIVED_FROM_PERFORMANCE);
  });

  it('does not fabricate teamwork or appearance without evidence', () => {
    const result = calculateFinalEvaluation(perfectInput({ supervisorRatings: {} }));
    assert.equal(result.criterion6Score, null);
    assert.equal(result.criterion7Score, null);
    assert.equal(result.criterionEvidence.criterion6.missingEvidence, 'PROFESSIONAL_CRITERION_6_EVIDENCE_MISSING');
    assert.equal(result.criterionEvidence.criterion7.missingEvidence, 'PROFESSIONAL_CRITERION_7_EVIDENCE_MISSING');
  });

  it('derives thinking and problem solving when assessment/task evidence exists', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        supervisorRatings: {},
        postAssessmentScore: 88,
        taskScoreAveragePercent: 92,
        acceptedTaskCount: 4,
      })
    );
    assert.ok(result.criterion3Score >= 4);
    assert.ok(result.criterion4Score >= 4);
    assert.equal(result.criterionEvidence.criterion3.source, SCORE_SOURCE.DERIVED_FROM_PERFORMANCE);
  });

  it('uses direct supervisor rating override when present', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        supervisorRatings: { ...fullRatings, teamwork: 2 },
        taskScoreAveragePercent: 99,
        attendancePercentage: 99,
      })
    );
    assert.equal(result.criterion6Score, 2);
    assert.equal(result.criterionEvidence.criterion6.source, SCORE_SOURCE.DIRECT_SUPERVISOR_RATING);
  });

  it('does not default unknown hours to zero in payload mapping', () => {
    const hours = summarizeAttendance([], { completed_training_hours: null });
    assert.equal(hours.actualHours, null);
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      application: {},
      opportunity: {},
      attendanceRows: [],
      evaluation: {
        criterion1Score: 4,
        criterion2Score: 4,
        criterion3Score: 4,
        criterion4Score: 4,
        criterion5Score: 4,
        criterion6Score: 4,
        criterion7Score: 4,
        criterion8Score: 4,
        criterion9Score: 4,
        criterion10Score: 4,
        eligibilityStatus: 'ELIGIBLE',
        generalComments: 'test',
      },
    });
    assert.equal(payload.training_hours_display, null);
    assert.equal(payload.actual_training_hours, null);
  });

  it('calculates professional total when all ten criteria exist', () => {
    const result = calculateFinalEvaluation(perfectInput());
    assert.equal(result.professionalTotal, 50);
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
  });

  it('still scores NOT_ELIGIBLE students when performance evidence exists', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        completedHours: 118,
        requiredHours: 140,
        attendancePercentage: 72,
      })
    );
    assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(result.criterion1Score != null);
    assert.ok(result.criterion5Score != null);
    const comment = buildAutoComment(result, { eligibilityStatus: 'NOT_ELIGIBLE', reasonLabels: ['نسبة الحضور 72%'] });
    assert.match(comment, /غير مؤهل/);
  });

  it('does not treat missing post-assessment as zero in derived efficiency', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        postAssessmentScore: null,
        supervisorRatings: fullRatings,
      }),
      { postAssessmentRequired: true }
    );
    assert.equal(result.postAssessmentScore, null);
    assert.ok(result.criterion1Score >= 1);
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.POST_ASSESSMENT_NOT_COMPLETED));
  });

  it('classifies readiness categories', () => {
    const automatic = classifyEvaluationReadiness({
      missingFieldEntries: [],
      criterionEvidence: {
        criterion1: { source: SCORE_SOURCE.DERIVED_FROM_PERFORMANCE, score: 5 },
      },
      usesManualRating: false,
    });
    assert.equal(automatic.readinessCategory, 'READY_AUTOMATIC');

    const manual = classifyEvaluationReadiness({
      missingFieldEntries: [],
      criterionEvidence: {
        criterion6: { source: SCORE_SOURCE.DIRECT_SUPERVISOR_RATING, score: 4 },
      },
      usesManualRating: true,
    });
    assert.equal(manual.readinessCategory, 'READY_WITH_MANUAL_RATING');

    const missingStatic = classifyEvaluationReadiness({
      missingFieldEntries: [{ code: 'STUDENT_NUMBER_MISSING' }],
      criterionEvidence: {},
    });
    assert.equal(missingStatic.readinessCategory, 'MISSING_STATIC_DATA');
  });

  it('regression: Omar-like student keeps hours unknown-not-zero and flags behavioral gaps', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        completedHours: null,
        requiredHours: 140,
        hoursDataLoaded: false,
        supervisorRatings: {},
        postAssessmentScore: 80,
        taskScoreAveragePercent: 85,
        acceptedTaskCount: 4,
      })
    );
    assert.equal(result.performanceSnapshot.completedTrainingHours, null);
    assert.equal(result.criterion6Score, null);
    assert.equal(result.criterion7Score, null);
    assert.notEqual(result.criterion1Score, null);
    assert.notEqual(result.criterion5Score, null);
    assert.equal(result.professionalTotal, null);
  });

  it('low attendance yields low criterion 5 without inventing lateness', () => {
    const result = calculateFinalEvaluation(
      perfectInput({
        attendancePercentage: 55,
        completedHours: 140,
        supervisorRatings: fullRatings,
      })
    );
    assert.equal(result.criterion5Score, 2);
    assert.equal(result.finalStatus, FINAL_STATUS.NOT_ELIGIBLE);
  });
});
