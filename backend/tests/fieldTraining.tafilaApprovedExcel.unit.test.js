'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  TAFILA_APPROVED_EXCEL_BASELINE,
  baselineCount,
  LAITH_UNIVERSITY_NUMBER,
  APPROVED_NOT_ELIGIBLE,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline');
const {
  proposeApprovedResult,
  computeEligibleApprovedScore,
  applyApprovedDisplayToQualification,
  SOURCE,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  hasEligibleFailureReason,
  labelsForApproved,
} = require('../src/modules/fieldTraining/fieldTraining.tafilaApprovedResult.service');

describe('Tafila AUTHORIZED_MANUAL_REVIEW reconciliation', () => {
  it('has exactly 151 baseline mappings', () => {
    assert.equal(baselineCount, 151);
  });

  it('keeps historically ELIGIBLE students eligible even when live score < 80', () => {
    const row = {
      applicationId: 'a1',
      studentName: 'X',
      universityNumber: '320220603017',
      app: { eligibility_reason: { details: { finalScore: 50.8 } }, completion_eligibility_status: 'ineligible' },
      baseline: TAFILA_APPROVED_EXCEL_BASELINE['320220603017'],
    };
    const out = proposeApprovedResult(row, {
      finalScore: 50.8,
      attendanceComponentScore: 20,
      postAssessmentComponentScore: 17.6,
      tasksComponentScore: 0,
      professionalComponentScore: 13.2,
      scoreComponents: { tasks: { details: [], points: 0 } },
    });
    assert.equal(out.finalApprovedStatus, 'ELIGIBLE');
    assert.ok(out.finalApprovedScore >= 80);
    assert.equal(out.approvedEvaluationResult.source, SOURCE.AUTHORIZED_MANUAL_REVIEW);
  });

  it('reconstructs excel score breakdown for ELIGIBLE >= 80', () => {
    const computed = computeEligibleApprovedScore({
      attendancePoints: 20,
      postAssessmentPoints: 20,
      behaviorPoints: 16.8,
      rawTaskPoints: 17,
      excelScore: 89,
    });
    assert.equal(computed.approvedFinalScore, 89);
    assert.equal(computed.approvedTaskPoints, 32.2);
    assert.ok(computed.taskCorrected);
  });

  it('does not force identical 80 scores for different bases', () => {
    const a = computeEligibleApprovedScore({
      attendancePoints: 20,
      postAssessmentPoints: 20,
      behaviorPoints: 14,
      rawTaskPoints: 0,
      excelScore: 76,
    });
    const b = computeEligibleApprovedScore({
      attendancePoints: 17.5,
      postAssessmentPoints: 20,
      behaviorPoints: 13.6,
      rawTaskPoints: 0,
      excelScore: 73,
    });
    assert.ok(a.approvedFinalScore >= 80);
    assert.ok(b.approvedFinalScore >= 80);
    assert.notEqual(a.approvedFinalScore, b.approvedFinalScore);
  });

  it('keeps approved NOT_ELIGIBLE students not eligible', () => {
    for (const uni of APPROVED_NOT_ELIGIBLE.filter((u) => u !== LAITH_UNIVERSITY_NUMBER)) {
      const row = {
        applicationId: uni,
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
    }
  });

  it('keeps Laith NOT_ELIGIBLE with task points 16.2', () => {
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
    assert.ok(out.finalApprovedScore < 80);
  });

  it('eligible labels never include failure reasons', () => {
    const labels = labelsForApproved({
      finalApprovedStatus: 'ELIGIBLE',
      approvedEvaluationResult: { source: SOURCE.AUTHORIZED_MANUAL_REVIEW },
    });
    assert.equal(hasEligibleFailureReason(labels.labelsAr), false);
  });

  it('applies approved display overlay for primary opportunity', () => {
    const q = applyApprovedDisplayToQualification(
      { finalScore: 70, scoreComponents: { attendance: { points: 10 }, postAssessment: { points: 10 }, tasks: { points: 10 }, behavior: { points: 10 } } },
      {
        approvedEvaluationResult: {
          approvedFinalScore: 86,
          approvedStatus: 'ELIGIBLE',
          source: SOURCE.AUTHORIZED_MANUAL_REVIEW,
          scoreBreakdown: {
            attendancePoints: 20,
            postAssessmentPoints: 20,
            taskPoints: 30,
            behaviorPoints: 16,
          },
        },
        calculatedFinalScore: 70,
        labelsAr: ['مؤهل وفق النتيجة النهائية المعتمدة.'],
      },
      PRIMARY_TAFILA_OPPORTUNITY_ID
    );
    assert.equal(q.finalScore, 86);
    assert.equal(q.scoreComponents.tasks.points, 30);
  });
});
