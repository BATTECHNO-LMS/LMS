'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSubmittedTaskScore,
  buildNormalizedTaskEvaluation,
  computeEligibleApprovedScore,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaTaskNormalization');
const {
  proposeApprovedResult,
  SOURCE,
  LAITH_UNIVERSITY_NUMBER,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');
const {
  TAFILA_APPROVED_EXCEL_BASELINE,
  APPROVED_NOT_ELIGIBLE,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');

describe('Tafila 80–90 task normalization', () => {
  it('normalizes deterministically', () => {
    assert.equal(normalizeSubmittedTaskScore(50), 85);
    assert.equal(normalizeSubmittedTaskScore(60), 86);
    assert.equal(normalizeSubmittedTaskScore(70), 87);
    assert.equal(normalizeSubmittedTaskScore(80), 88);
    assert.equal(normalizeSubmittedTaskScore(90), 89);
    assert.equal(normalizeSubmittedTaskScore(100), 90);
    assert.equal(normalizeSubmittedTaskScore(null), 80);
  });

  it('averages submitted-only tasks', () => {
    const evaln = buildNormalizedTaskEvaluation([
      { title: 't1', accepted: true, rawScore: 60, reviewStatus: 'graded' },
      { title: 't2', accepted: true, rawScore: 80, reviewStatus: 'graded' },
      { title: 't3', accepted: false, rawScore: null, source: 'MISSING_OR_NOT_ACCEPTED' },
      { title: 't4', accepted: false, rawScore: null, source: 'MISSING_OR_NOT_ACCEPTED' },
    ]);
    assert.equal(evaln.submittedCount, 2);
    assert.equal(evaln.approvedTaskAverage, 87);
    assert.equal(evaln.approvedTaskPoints, 34.8);
    assert.equal(evaln.details[2].submissionStatus, 'NOT_SUBMITTED');
    assert.equal(evaln.details[2].approvedTaskScore, null);
  });

  it('uses legacy aggregate for zero submitted tasks', () => {
    const out = computeEligibleApprovedScore({
      attendancePoints: 20,
      postAssessmentPoints: 20,
      behaviorPoints: 14,
      rawTaskPoints: 0,
      excelScore: 76,
      taskDetails: [
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
      ],
    });
    assert.equal(out.source, 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT');
    assert.ok(out.approvedFinalScore >= 80);
    assert.equal(out.taskEvaluation.submittedCount, 0);
  });

  it('coerces missing components to zero and still reaches eligible final', () => {
    const out = computeEligibleApprovedScore({
      attendancePoints: 20,
      postAssessmentPoints: 20,
      behaviorPoints: null,
      rawTaskPoints: 0,
      excelScore: 80,
      taskDetails: [
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
        { accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
      ],
    });
    assert.equal(out.source, 'AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT');
    assert.equal(out.approvedTaskPoints, 40);
    assert.equal(out.approvedFinalScore, 80);
  });

  it('keeps historically eligible with partial submissions', () => {
    const row = {
      applicationId: 'a1',
      studentName: 'X',
      universityNumber: '320220603012',
      app: { eligibility_reason: {}, completion_eligibility_status: 'ineligible' },
      baseline: TAFILA_APPROVED_EXCEL_BASELINE['320220603012'],
    };
    const out = proposeApprovedResult(row, {
      finalScore: 61,
      attendanceComponentScore: 20,
      postAssessmentComponentScore: 17.6,
      tasksComponentScore: 8.6,
      professionalComponentScore: 14.8,
      scoreComponents: {
        tasks: {
          details: [
            { title: 'المهمة الأولى', accepted: true, rawScore: 70, reviewStatus: 'graded' },
            { title: 'المهمة الثانية', accepted: true, rawScore: 50, reviewStatus: 'graded' },
            { title: 'المهمة الثالثة', accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
            { title: 'المهمة الرابعة', accepted: false, source: 'MISSING_OR_NOT_ACCEPTED' },
          ],
        },
      },
    });
    assert.equal(out.finalApprovedStatus, 'ELIGIBLE');
    assert.ok(out.finalApprovedScore >= 80);
    assert.equal(out.approvedEvaluationResult.source, SOURCE.AUTHORIZED_MANUAL_REVIEW);
    const submitted = out.approvedEvaluationResult.approvedTaskEvaluation.details.filter(
      (d) => d.submissionStatus === 'SUBMITTED'
    );
    assert.equal(submitted.length, 2);
    assert.ok(submitted.every((d) => d.approvedTaskScore >= 80 && d.approvedTaskScore <= 90));
  });

  it('does not normalize historically not-eligible students', () => {
    const uni = APPROVED_NOT_ELIGIBLE.find((u) => u !== LAITH_UNIVERSITY_NUMBER);
    const row = {
      applicationId: 'n1',
      studentName: 'N',
      universityNumber: uni,
      app: { eligibility_reason: {}, completion_eligibility_status: 'ineligible' },
      baseline: TAFILA_APPROVED_EXCEL_BASELINE[uni],
    };
    const out = proposeApprovedResult(row, {
      finalScore: 90,
      attendanceComponentScore: 20,
      postAssessmentComponentScore: 20,
      tasksComponentScore: 40,
      professionalComponentScore: 20,
      scoreComponents: { tasks: { details: [] } },
    });
    assert.equal(out.finalApprovedStatus, 'NOT_ELIGIBLE');
  });

  it('keeps Laith fixed task grades and 16.2 points', () => {
    const row = {
      applicationId: 'laith',
      studentName: 'ليث',
      universityNumber: LAITH_UNIVERSITY_NUMBER,
      app: { eligibility_reason: {}, completion_eligibility_status: 'ineligible' },
      baseline: TAFILA_APPROVED_EXCEL_BASELINE[LAITH_UNIVERSITY_NUMBER],
    };
    const out = proposeApprovedResult(
      row,
      {
        finalScore: null,
        attendanceComponentScore: 20,
        postAssessmentComponentScore: 14.4,
        tasksComponentScore: 16.2,
        professionalComponentScore: null,
        scoreComponents: { tasks: { points: 16.2, details: [] } },
      },
      { laithBehavior: { behaviorPoints: 8.8, source: SOURCE.AUTHORIZED_MANUAL_REVIEW } }
    );
    assert.equal(out.finalApprovedStatus, 'NOT_ELIGIBLE');
    assert.equal(out.scoreBreakdown.taskPoints, 16.2);
    assert.equal(out.finalApprovedScore, 59.4);
  });
});
