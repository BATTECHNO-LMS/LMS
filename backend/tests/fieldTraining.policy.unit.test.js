'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  POLICY_FAMILY,
  RESULT_SOURCE_KIND,
  INVALID_COMBINATION,
  CURRENT_DEFAULT_SCORING_POLICY,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  SECONDARY_TAFILA_OPPORTUNITY_ID,
  resolveFieldTrainingPolicy,
  materializeQualificationPolicy,
  defaultCompletionRulesForNewOpportunity,
  validateOfficialResultIntegrity,
  isCompletedAndIneligible,
} = require('../src/modules/fieldTraining/fieldTraining.policy.service');
const {
  buildOfficialResult,
  toPublicQualificationFromOfficial,
  isOfficiallyEligible,
  RESULT_SOURCE,
  round1,
} = require('../src/modules/fieldTraining/fieldTraining.officialResult.service');
const {
  calculateFieldTrainingFinalQualification,
  round1: qualRound1,
} = require('../src/modules/fieldTraining/fieldTraining.qualification');
const {
  TAFILA_SCORING_RULES,
  DEFAULT_POLICY,
  SCORING_MODEL,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const { mapStudentExcelRow } = require('../src/modules/fieldTraining/fieldTrainingStudentsExcel');

const TAFILA_FIXED_POLICY = {
  id: 'uni-tafila-policy',
  version: 3,
  minimumPassingScore: 80,
  attendanceWeight: 20,
  postAssessmentWeight: 20,
  tasksWeight: 40,
  professionalEvaluationWeight: 20,
  scoringRules: TAFILA_SCORING_RULES,
};

const FULL_RATINGS = {
  thinkingAndInitiative: 5,
  problemSolving: 5,
  teamwork: 5,
  professionalConduct: 5,
  supervisorCooperation: 5,
  rulesCompliance: 5,
};

function taskRow(title, percent, { accepted = true } = {}) {
  return {
    taskId: title,
    title,
    reviewStatus: accepted ? 'graded' : null,
    manualScore: accepted ? percent : null,
    maxScore: 100,
  };
}

function overlayApp(overrides = {}) {
  return {
    id: 'app-tafila-1',
    student_id: 'stu-1',
    opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID,
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
        passingScore: 80,
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

function laithApp() {
  return overlayApp({
    id: 'laith-app',
    completion_eligibility_status: 'ineligible',
    training_status: 'completed',
    eligibility_reason: {
      reasons: ['AUTHORIZED_ADMIN_ELIGIBILITY_DECISION'],
      labelsAr: ['قرار إداري معتمد بعدم التأهيل مع الاحتفاظ بالعلامات الفعلية للطالب.'],
      details: {
        displayFinalScore: 59.4,
        passingScore: 80,
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
  });
}

describe('P1 Field Training policy selector', () => {
  it('A. FIXED_COMPONENTS_V1 opportunity uses live 20/20/40/20', () => {
    const policy = resolveFieldTrainingPolicy({
      application: { id: 'a1', opportunity_id: 'opp-fixed' },
      opportunity: {
        id: 'opp-fixed',
        completion_rules: { scoringPolicy: 'FIXED_COMPONENTS_V1' },
      },
      universityPolicy: DEFAULT_POLICY,
    });
    assert.equal(policy.family, POLICY_FAMILY.FIXED_COMPONENTS_V1);
    assert.equal(policy.resultSourceKind, RESULT_SOURCE_KIND.LIVE_CALCULATION);
    assert.equal(policy.renormalizeMissingComponents, false);
    assert.equal(policy.qualificationThreshold, 80);
    const materialized = materializeQualificationPolicy(DEFAULT_POLICY, policy);
    assert.equal(materialized.attendanceWeight, 20);
    assert.equal(materialized.postAssessmentWeight, 20);
    assert.equal(materialized.tasksWeight, 40);
    assert.equal(materialized.professionalEvaluationWeight, 20);
    assert.equal(materialized.scoringRules.renormalizeMissingComponents, false);
  });

  it('B. unstamped legacy opportunity stays LEGACY_WEIGHTED', () => {
    const policy = resolveFieldTrainingPolicy({
      application: { id: 'a2', opportunity_id: 'opp-legacy' },
      opportunity: { id: 'opp-legacy', completion_rules: null },
      universityPolicy: DEFAULT_POLICY,
    });
    assert.equal(policy.family, POLICY_FAMILY.LEGACY_WEIGHTED_V1);
    assert.equal(policy.selectedBy, 'university_evaluation_policy');
    assert.equal(policy.preserveApprovedOverlayOnPersist, false);
    const materialized = materializeQualificationPolicy(DEFAULT_POLICY, policy);
    assert.equal(materialized.tasksWeight, DEFAULT_POLICY.tasksWeight);
    assert.equal(materialized.professionalEvaluationWeight, DEFAULT_POLICY.professionalEvaluationWeight);

    const fallback = resolveFieldTrainingPolicy({
      application: { id: 'a2b', opportunity_id: 'opp-legacy-2' },
      opportunity: { id: 'opp-legacy-2' },
      universityPolicy: null,
    });
    assert.equal(fallback.family, POLICY_FAMILY.LEGACY_WEIGHTED_V1);
    assert.equal(fallback.selectedBy, 'legacy_unstamped_fallback');
  });

  it('C. historical approved Tafila overlay is HISTORICAL_APPROVED_RESULT', () => {
    const policy = resolveFieldTrainingPolicy({
      application: overlayApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      universityPolicy: TAFILA_FIXED_POLICY,
    });
    assert.equal(policy.family, POLICY_FAMILY.HISTORICAL_APPROVED_RESULT);
    assert.equal(policy.historicalException, 'PRIMARY_TAFILA_ONLINE');
    assert.equal(policy.isHistoricalApprovedResult, true);
    assert.equal(policy.useLiveCalculation, false);
    assert.equal(policy.preserveApprovedOverlayOnPersist, true);
  });

  it('D. manual FORCE_NOT_ELIGIBLE overlay has explicit precedence', () => {
    const policy = resolveFieldTrainingPolicy({
      application: laithApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      universityPolicy: TAFILA_FIXED_POLICY,
    });
    assert.equal(policy.family, POLICY_FAMILY.MANUAL_APPROVED_OVERRIDE);
    assert.equal(policy.isManualOverride, true);
    assert.equal(policy.preserveApprovedOverlayOnPersist, true);
    assert.equal(policy.resultSourceKind, RESULT_SOURCE_KIND.APPROVED_OVERLAY);
  });

  it('E. ineligible live student keeps NOT_ELIGIBLE official result', () => {
    const official = buildOfficialResult({
      app: {
        id: 'inelig-1',
        student_id: 's',
        opportunity_id: 'opp-fixed',
        completion_eligibility_status: 'ineligible',
        training_status: 'in_training',
        eligibility_reason: null,
      },
      opportunity: { id: 'opp-fixed', completion_rules: { scoringPolicy: 'FIXED_COMPONENTS_V1' } },
      taskCounts: { submitted: 1, graded: 1, required: 4 },
      liveCalculated: {
        finalScore: 59.4,
        eligibilityStatus: 'NOT_ELIGIBLE',
        workflowOutcome: 'ineligible',
        scorePassed: false,
        eligibilityReasonLabels: ['العلامة النهائية أقل من حد التأهيل'],
        eligibilityReasons: ['FINAL_SCORE_BELOW_MINIMUM'],
        policy: TAFILA_FIXED_POLICY,
        scoreComponents: {
          attendance: { points: 20 },
          postAssessment: { points: 14.4 },
          tasks: { points: 16.2 },
          behavior: { points: 8.8 },
        },
      },
    });
    assert.equal(official.eligibility, 'NOT_ELIGIBLE');
    assert.equal(official.finalScore, 59.4);
    assert.equal(isOfficiallyEligible(official), false);
  });

  it('F. completed + ineligible is VALID and is not auto-corrected', () => {
    const official = buildOfficialResult({
      app: laithApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    assert.equal(official.trainingStatus, 'completed');
    assert.equal(official.eligibility, 'NOT_ELIGIBLE');
    assert.equal(official.finalScore, 59.4);
    assert.equal(official.integrity.completedAndIneligibleIsValid, true);
    assert.equal(official.integrity.valid, true);
    assert.equal(isCompletedAndIneligible('completed', 'NOT_ELIGIBLE'), true);
    assert.ok(!official.integrity.issues.includes(INVALID_COMBINATION.ELIGIBLE_FAILED));
  });

  it('G. failed + eligible is invalid', () => {
    const integrity = validateOfficialResultIntegrity({
      eligibility: 'ELIGIBLE',
      trainingStatus: 'failed',
      finalScore: 90,
      qualificationThreshold: 80,
    });
    assert.equal(integrity.valid, false);
    assert.ok(integrity.issues.includes(INVALID_COMBINATION.ELIGIBLE_FAILED));
  });

  it('H. expelled + eligible is invalid', () => {
    const integrity = validateOfficialResultIntegrity({
      eligibility: 'ELIGIBLE',
      trainingStatus: 'expelled',
      finalScore: 90,
      qualificationThreshold: 80,
    });
    assert.equal(integrity.valid, false);
    assert.ok(integrity.issues.includes(INVALID_COMBINATION.ELIGIBLE_EXPELLED));
  });

  it('I. missing task component does not renormalize other weights', () => {
    const calculated = calculateFieldTrainingFinalQualification(
      {
        attendancePercentage: 100,
        completedHours: 140,
        requiredHours: 140,
        preAssessmentScore: 70,
        postAssessmentScore: 100,
        supervisorRatings: FULL_RATINGS,
        requiredTaskRows: [
          taskRow('t1', 0, { accepted: false }),
          taskRow('t2', 0, { accepted: false }),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
        requiredTaskCount: 4,
        acceptedTaskCount: 0,
      },
      TAFILA_FIXED_POLICY,
      { application: { training_status: 'in_training' } }
    );
    assert.equal(calculated.attendanceComponentScore, 20);
    assert.equal(calculated.postAssessmentComponentScore, 20);
    assert.equal(calculated.tasksComponentScore, 0);
    assert.equal(
      calculated.finalScore,
      round1(
        calculated.attendanceComponentScore +
          calculated.postAssessmentComponentScore +
          calculated.tasksComponentScore +
          calculated.professionalComponentScore
      )
    );
    assert.ok(calculated.finalScore < 100);
    assert.notEqual(calculated.finalScore, 100);
  });

  it('J. threshold boundary exactly 80 can be eligible', () => {
    const calculated = calculateFieldTrainingFinalQualification(
      {
        attendancePercentage: 100,
        completedHours: 140,
        requiredHours: 140,
        preAssessmentScore: 70,
        postAssessmentScore: 100,
        supervisorRatings: FULL_RATINGS,
        requiredTaskRows: [
          taskRow('t1', 50),
          taskRow('t2', 50),
          taskRow('t3', 50),
          taskRow('t4', 50),
        ],
        requiredTaskCount: 4,
        acceptedTaskCount: 4,
      },
      TAFILA_FIXED_POLICY,
      { application: { training_status: 'in_training' } }
    );
    assert.equal(calculated.finalScore, 80);
    assert.equal(calculated.scorePassed, true);
    assert.equal(calculated.eligibilityStatus, 'ELIGIBLE');
  });

  it('K. just below threshold is not eligible', () => {
    const calculated = calculateFieldTrainingFinalQualification(
      {
        attendancePercentage: 100,
        completedHours: 140,
        requiredHours: 140,
        preAssessmentScore: 70,
        postAssessmentScore: 99,
        supervisorRatings: FULL_RATINGS,
        requiredTaskRows: [
          taskRow('t1', 50),
          taskRow('t2', 50),
          taskRow('t3', 50),
          taskRow('t4', 48),
        ],
        requiredTaskCount: 4,
        acceptedTaskCount: 4,
      },
      TAFILA_FIXED_POLICY,
      { application: { training_status: 'in_training' } }
    );
    assert.ok(calculated.finalScore < 80);
    assert.equal(calculated.scorePassed, false);
    assert.equal(calculated.eligibilityStatus, 'NOT_ELIGIBLE');
  });

  it('L. rounding is centralized at 1 decimal', () => {
    assert.equal(round1(90.35), 90.4);
    assert.equal(qualRound1(90.35), 90.4);
    assert.equal(round1(59.44), 59.4);
    assert.equal(round1(59.45), 59.5);
  });

  it('new opportunities receive explicit FIXED_COMPONENTS_V1 completion_rules', () => {
    const rules = defaultCompletionRulesForNewOpportunity(null);
    assert.equal(rules.scoringPolicy, POLICY_FAMILY.FIXED_COMPONENTS_V1);
    assert.equal(rules.requireAllRequiredTasksSubmitted, false);
    const preserved = defaultCompletionRulesForNewOpportunity({
      scoringPolicy: 'LEGACY_WEIGHTED_V1',
      manual_review_required: true,
    });
    assert.equal(preserved.scoringPolicy, 'LEGACY_WEIGHTED_V1');
  });

  it('does not merge the second Tafila opportunity into the primary cohort', () => {
    const primary = resolveFieldTrainingPolicy({
      application: overlayApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      universityPolicy: TAFILA_FIXED_POLICY,
    });
    const second = resolveFieldTrainingPolicy({
      application: {
        id: 'app-2',
        opportunity_id: SECONDARY_TAFILA_OPPORTUNITY_ID,
        eligibility_reason: null,
      },
      opportunity: { id: SECONDARY_TAFILA_OPPORTUNITY_ID },
      universityPolicy: TAFILA_FIXED_POLICY,
    });
    assert.equal(primary.historicalException, 'PRIMARY_TAFILA_ONLINE');
    assert.equal(second.historicalException, null);
    assert.equal(second.opportunityId, SECONDARY_TAFILA_OPPORTUNITY_ID);
    assert.notEqual(second.family, POLICY_FAMILY.HISTORICAL_APPROVED_RESULT);
  });

  it('does not apply all-tasks as a hard gate when the new policy sets it false', () => {
    const policy = {
      ...TAFILA_FIXED_POLICY,
      scoringRules: {
        ...TAFILA_SCORING_RULES,
        requireAllRequiredTasksSubmitted: false,
        allowPassingScoreWithPartialTaskSubmissions: true,
      },
    };
    const calculated = calculateFieldTrainingFinalQualification(
      {
        attendancePercentage: 100,
        completedHours: 140,
        requiredHours: 140,
        preAssessmentScore: 80,
        postAssessmentScore: 100,
        supervisorRatings: FULL_RATINGS,
        requiredTaskRows: [
          taskRow('t1', 100),
          taskRow('t2', 100),
          taskRow('t3', 100),
          taskRow('t4', 100, { accepted: false }),
        ],
        requiredTaskCount: 4,
        acceptedTaskCount: 3,
      },
      policy,
      { application: { training_status: 'in_training' } }
    );
    assert.equal(calculated.mandatoryRequirements.requiredTasksCompleted, true);
    assert.ok(calculated.finalScore >= 80);
    assert.equal(calculated.eligibilityStatus, 'ELIGIBLE');
  });

  it('recalculation is idempotent with no score drift', () => {
    const input = {
      attendancePercentage: 90,
      completedHours: 140,
      requiredHours: 140,
      preAssessmentScore: 70,
      postAssessmentScore: 85,
      supervisorRatings: FULL_RATINGS,
      requiredTaskRows: [taskRow('t1', 92), taskRow('t2', 92), taskRow('t3', 92), taskRow('t4', 92)],
      requiredTaskCount: 4,
      acceptedTaskCount: 4,
    };
    const a = calculateFieldTrainingFinalQualification(input, TAFILA_FIXED_POLICY, {});
    const b = calculateFieldTrainingFinalQualification(input, TAFILA_FIXED_POLICY, {});
    assert.equal(a.finalScore, b.finalScore);
    assert.equal(a.eligibilityStatus, b.eligibilityStatus);
    assert.equal(a.attendanceComponentScore, b.attendanceComponentScore);
    assert.equal(a.tasksComponentScore, b.tasksComponentScore);
  });

  it('cross-output official score matches public qualification and Excel', () => {
    const official = buildOfficialResult({
      app: laithApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID, required_training_hours: 140 },
      taskCounts: { submitted: 2, graded: 2, required: 4 },
    });
    const publicQ = toPublicQualificationFromOfficial(official);
    const excel = mapStudentExcelRow(
      {
        qualification: publicQ,
        officialResult: official,
        eligibility_status: official.eligibilityDb,
        completion_eligibility_status: official.eligibilityDb,
        training_status: official.trainingStatus,
      },
      0
    );
    assert.equal(official.finalScore, 59.4);
    assert.equal(publicQ.finalScore, official.finalScore);
    assert.equal(publicQ.eligibilityStatus, official.eligibility);
    assert.equal(Number(excel.finalScore), official.finalScore);
    assert.equal(excel.eligibilityStatus, 'غير مؤهل');
    assert.equal(isOfficiallyEligible(official), false);
    assert.equal(official.resultSource, 'AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE');
  });

  it('eligible overlay never keeps a below-threshold reason', () => {
    const official = buildOfficialResult({
      app: overlayApp({
        eligibility_reason: {
          reasons: ['FINAL_SCORE_BELOW_MINIMUM', 'APPROVED_ELIGIBLE'],
          labelsAr: ['العلامة النهائية أقل من حد التأهيل', 'مؤهل وفق النتيجة النهائية المعتمدة بعد مراجعة التقييم.'],
          details: overlayApp().eligibility_reason.details,
        },
      }),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      taskCounts: { submitted: 4, graded: 4, required: 4 },
    });
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.ok(!official.reasonCodes.includes('FINAL_SCORE_BELOW_MINIMUM'));
    assert.ok(official.reasons.every((label) => !/أقل من حد التأهيل/.test(String(label))));
  });

  it('does not treat Tafila university FIXED policy as a reason to overwrite overlay', () => {
    const policy = resolveFieldTrainingPolicy({
      application: overlayApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      universityPolicy: TAFILA_FIXED_POLICY,
    });
    assert.equal(policy.scoringModel, SCORING_MODEL.FIXED_COMPONENTS_V1);
    assert.equal(policy.useLiveCalculation, false);
    const official = buildOfficialResult({
      app: overlayApp(),
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
      taskCounts: { submitted: 4, graded: 4, required: 4 },
      liveCalculated: { finalScore: 10, eligibilityStatus: 'NOT_ELIGIBLE' },
    });
    assert.equal(official.finalScore, 86);
    assert.equal(official.eligibility, 'ELIGIBLE');
    assert.equal(official.isHistoricalApprovedResult, true);
  });
});
