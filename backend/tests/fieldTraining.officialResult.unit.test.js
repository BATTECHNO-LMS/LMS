'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildOfficialResult,
  toPublicQualificationFromOfficial,
  toOfficialSnapshot,
  officialSnapshotsEqual,
  canonicalizeEligibility,
  isOfficiallyEligible,
  officialEligibilityFromApplication,
  RESULT_SOURCE,
} = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');

const TAFILA_OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const SECOND_TAFILA_OPP = '01666ebc-bfc1-4948-87a5-2add3f641c65';

function overlayApp(overrides = {}) {
  return {
    id: 'app-tafila-1',
    student_id: 'stu-1',
    opportunity_id: TAFILA_OPP,
    completion_eligibility_status: 'eligible',
    training_status: 'completed',
    attendance_percentage: 100,
    completed_training_hours: 140,
    post_assessment_score: 90,
    eligibility_reason: {
      reasons: ['APPROVED_ELIGIBLE'],
      labelsAr: ['مؤهل وفق النتيجة النهائية المعتمدة بعد مراجعة التقييم.'],
      details: {
        finalScore: 86,
        displayFinalScore: 86,
        calculatedFinalScore: 70,
        approvedEvaluationResult: {
          approvedFinalScore: 86,
          approvedStatus: 'ELIGIBLE',
          source: 'AUTHORIZED_MANUAL_REVIEW',
          approvedAt: '2026-09-01T00:00:00.000Z',
          scoreBreakdown: {
            attendancePoints: 20,
            postAssessmentPoints: 20,
            taskPoints: 30,
            behaviorPoints: 16,
          },
        },
      },
    },
    ...overrides,
  };
}

describe('official Field Training result resolver', () => {
  it('uses stored Tafila approved overlay and never live-recalculates it', () => {
    const official = buildOfficialResult({
      app: overlayApp(),
      opportunity: { id: TAFILA_OPP, required_training_hours: 140 },
      taskCounts: { submitted: 4, graded: 4, required: 4 },
      liveCalculated: {
        finalScore: 50.8,
        eligibilityStatus: 'NOT_ELIGIBLE',
        workflowOutcome: 'ineligible',
        attendanceComponentScore: 10,
        scoreComponents: {
          attendance: { points: 10 },
          postAssessment: { points: 10 },
          tasks: { points: 10 },
          behavior: { points: 10 },
        },
      },
    });
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.equal(official.finalScore, 86);
    assert.equal(official.attendancePoints, 20);
    assert.equal(official.postPoints, 20);
    assert.equal(official.taskPoints, 30);
    assert.equal(official.behaviorPoints, 16);
    assert.equal(official.calculatedFinalScore, 70);
    assert.equal(official.resultSource, 'AUTHORIZED_MANUAL_REVIEW');
    assert.equal(official.submittedTaskCount, 4);
    assert.equal(official.requiredTaskCount, 4);
  });

  it('keeps Laith NOT_ELIGIBLE at 59.4 with LMS task count 2/4', () => {
    const official = buildOfficialResult({
      app: overlayApp({
        id: 'laith-app',
        completion_eligibility_status: 'ineligible',
        training_status: 'completed',
        eligibility_reason: {
          reasons: ['AUTHORIZED_ADMIN_ELIGIBILITY_DECISION'],
          labelsAr: ['قرار إداري معتمد بعدم التأهيل مع الاحتفاظ بالعلامات الفعلية للطالب.'],
          details: {
            displayFinalScore: 59.4,
            approvedEvaluationResult: {
              approvedFinalScore: 59.4,
              approvedStatus: 'NOT_ELIGIBLE',
              source: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
              scoreBreakdown: {
                attendancePoints: 20,
                postAssessmentPoints: 14.4,
                taskPoints: 16.2,
                behaviorPoints: 8.8,
              },
            },
          },
        },
      }),
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    assert.equal(official.eligibility, 'NOT_ELIGIBLE');
    assert.equal(official.finalScore, 59.4);
    assert.equal(official.taskPoints, 16.2);
    assert.equal(official.submittedTaskCount, 2);
    assert.equal(official.requiredTaskCount, 4);
    assert.equal(official.trainingStatus, 'completed');
    assert.equal(isOfficiallyEligible(official), false);
    const sum =
      official.attendancePoints + official.postPoints + official.taskPoints + official.behaviorPoints;
    assert.ok(Math.abs(sum - official.finalScore) <= 0.05);
  });

  it('does not infer submission count from approved score or excel text', () => {
    const official = buildOfficialResult({
      app: overlayApp({
        eligibility_reason: {
          labelsAr: ['أكمل 2 من أصل 4 تاسكات مطلوبة.'],
          details: {
            approvedEvaluationResult: {
              approvedFinalScore: 59.4,
              approvedStatus: 'NOT_ELIGIBLE',
              source: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
              approvedTaskEvaluation: { submittedCount: 4, requiredCount: 4 },
              scoreBreakdown: {
                attendancePoints: 20,
                postAssessmentPoints: 14.4,
                taskPoints: 16.2,
                behaviorPoints: 8.8,
              },
            },
          },
        },
      }),
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    assert.equal(official.submittedTaskCount, 2);
    assert.equal(official.requiredTaskCount, 4);
  });

  it('uses current qualification for opportunities without an approved overlay', () => {
    const official = buildOfficialResult({
      app: {
        id: 'app-normal',
        student_id: 'stu-n',
        opportunity_id: 'opp-normal',
        completion_eligibility_status: 'pending',
        training_status: 'in_training',
        attendance_percentage: 92,
        completed_training_hours: 140,
        post_assessment_score: 88,
        eligibility_reason: null,
      },
      opportunity: { required_training_hours: 140 },
      taskCounts: { submitted: 3, graded: 2, required: 4 },
      liveCalculated: {
        finalScore: 84.2,
        eligibilityStatus: 'ELIGIBLE',
        workflowOutcome: 'eligible',
        scorePassed: true,
        eligibilityReasonLabels: ['مؤهل'],
        eligibilityReasons: ['SCORE_PASSED'],
        scoreComponents: {
          attendance: { points: 18.4 },
          postAssessment: { points: 17.6 },
          tasks: { points: 32 },
          behavior: { points: 16.2 },
        },
      },
    });
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.equal(official.finalScore, 84.2);
    assert.equal(official.resultSource, RESULT_SOURCE.CURRENT_QUALIFICATION);
    assert.equal(official.submittedTaskCount, 3);
    assert.equal(official.attendancePoints, 18.4);
  });

  it('honors a stored manual approved overlay on a non-Tafila opportunity', () => {
    const official = buildOfficialResult({
      app: overlayApp({ opportunity_id: 'opp-other' }),
      taskCounts: { submitted: 4, graded: 4, required: 4 },
      liveCalculated: { finalScore: 40, eligibilityStatus: 'NOT_ELIGIBLE' },
    });
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.equal(official.finalScore, 86);
  });

  it('keeps second Tafila opportunity records separate', () => {
    const a = buildOfficialResult({
      app: overlayApp({ id: 'app-primary', opportunity_id: TAFILA_OPP }),
      taskCounts: { submitted: 4, graded: 4, required: 4 },
    });
    const b = buildOfficialResult({
      app: overlayApp({
        id: 'app-second',
        opportunity_id: SECOND_TAFILA_OPP,
        eligibility_reason: {
          labelsAr: [],
          details: {
            approvedEvaluationResult: {
              approvedFinalScore: 81,
              approvedStatus: 'ELIGIBLE',
              source: 'CURRENT_QUALIFICATION',
              scoreBreakdown: {
                attendancePoints: 20,
                postAssessmentPoints: 20,
                taskPoints: 21,
                behaviorPoints: 20,
              },
            },
          },
        },
      }),
      taskCounts: { submitted: 4, graded: 4, required: 4 },
    });
    assert.equal(a.opportunityId, TAFILA_OPP);
    assert.equal(b.opportunityId, SECOND_TAFILA_OPP);
    assert.notEqual(a.applicationId, b.applicationId);
    assert.notEqual(a.finalScore, b.finalScore);
  });

  it('preserves not-eligible results and missing components as null rather than inventing scores', () => {
    const official = buildOfficialResult({
      app: {
        id: 'app-missing',
        student_id: 'stu-m',
        opportunity_id: 'opp-n',
        completion_eligibility_status: 'ineligible',
        training_status: 'in_training',
        eligibility_reason: { labelsAr: ['تعذر احتساب علامة نهائية'], details: {} },
      },
      taskCounts: { submitted: 0, graded: 0, required: 4 },
      liveCalculated: {
        finalScore: null,
        eligibilityStatus: 'NOT_ELIGIBLE',
        workflowOutcome: 'ineligible',
        scoreComponents: {
          attendance: { points: null },
          postAssessment: { points: null },
          tasks: { points: null },
          behavior: { points: null },
        },
      },
    });
    assert.equal(official.eligibility, 'NOT_ELIGIBLE');
    assert.equal(official.finalScore, null);
    assert.equal(official.attendancePoints, null);
    assert.equal(official.submittedTaskCount, 0);
  });

  it('rounds official component points to one decimal', () => {
    const official = buildOfficialResult({
      app: overlayApp({
        eligibility_reason: {
          labelsAr: [],
          details: {
            approvedEvaluationResult: {
              approvedFinalScore: 59.4,
              approvedStatus: 'NOT_ELIGIBLE',
              source: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
              scoreBreakdown: {
                attendancePoints: 20.04,
                postAssessmentPoints: 14.36,
                taskPoints: 16.22,
                behaviorPoints: 8.79,
              },
            },
          },
        },
      }),
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    assert.equal(official.attendancePoints, 20);
    assert.equal(official.postPoints, 14.4);
    assert.equal(official.taskPoints, 16.2);
    assert.equal(official.behaviorPoints, 8.8);
    assert.equal(official.finalScore, 59.4);
  });

  it('returns the same official snapshot to report/export consumers', () => {
    const official = buildOfficialResult({
      app: overlayApp(),
      taskCounts: { submitted: 4, graded: 4, required: 4 },
    });
    const publicQ = toPublicQualificationFromOfficial(official);
    const fromUi = toOfficialSnapshot({
      ...official,
      finalScore: publicQ.finalScore,
      eligibility: publicQ.eligibilityStatus,
    });
    const fromReport = toOfficialSnapshot(official);
    assert.equal(officialSnapshotsEqual(fromUi, fromReport), true);
    assert.equal(publicQ.finalScore, 86);
    assert.equal(publicQ.workflowOutcome, 'eligible');
  });

  it('canonicalizes eligibility aliases without inventing new outcomes', () => {
    assert.equal(canonicalizeEligibility('eligible'), 'ELIGIBLE');
    assert.equal(canonicalizeEligibility('ineligible'), 'NOT_ELIGIBLE');
    assert.equal(canonicalizeEligibility('NOT_ELIGIBLE'), 'NOT_ELIGIBLE');
    assert.equal(canonicalizeEligibility('needs_review'), 'NEEDS_REVIEW');
    assert.equal(
      officialEligibilityFromApplication({
        completion_eligibility_status: 'eligible',
        eligibility_reason: {
          details: { approvedEvaluationResult: { approvedStatus: 'NOT_ELIGIBLE' } },
        },
      }),
      'NOT_ELIGIBLE'
    );
  });

  it('treats completed + ineligible as a valid official combination', () => {
    const official = buildOfficialResult({
      app: overlayApp({
        id: 'laith-app',
        completion_eligibility_status: 'ineligible',
        training_status: 'completed',
        eligibility_reason: {
          reasons: ['AUTHORIZED_ADMIN_ELIGIBILITY_DECISION'],
          labelsAr: ['قرار إداري معتمد بعدم التأهيل مع الاحتفاظ بالعلامات الفعلية للطالب.'],
          details: {
            displayFinalScore: 59.4,
            approvedEvaluationResult: {
              approvedFinalScore: 59.4,
              approvedStatus: 'NOT_ELIGIBLE',
              source: 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE',
              scoreBreakdown: {
                attendancePoints: 20,
                postAssessmentPoints: 14.4,
                taskPoints: 16.2,
                behaviorPoints: 8.8,
              },
            },
          },
        },
      }),
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    assert.equal(official.trainingStatus, 'completed');
    assert.equal(official.eligibility, 'NOT_ELIGIBLE');
    assert.equal(official.integrity.completedAndIneligibleIsValid, true);
    assert.equal(official.integrity.valid, true);
    assert.equal(official.policy, 'MANUAL_APPROVED_OVERRIDE');
  });

  it('flags expelled + eligible as an invalid official combination', () => {
    const official = buildOfficialResult({
      app: overlayApp({ training_status: 'expelled', expelled_at: '2026-09-01T00:00:00.000Z' }),
      opportunity: { id: TAFILA_OPP },
      taskCounts: { submitted: 4, graded: 4, required: 4 },
    });
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.equal(official.trainingStatus, 'expelled');
    assert.equal(official.integrity.valid, false);
    assert.ok(official.integrity.issues.includes('ELIGIBLE_EXPELLED'));
  });
});
