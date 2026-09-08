'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFieldTrainingFinalQualification,
  computeTasksComponent,
  pointsFromPercent,
  round1,
} = require('../src/modules/fieldTraining/fieldTraining.qualification');
const {
  TAFILA_SCORING_RULES,
  GATE_REASONS,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const { validatePolicyWeights, professionalTotals } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.scoring');

const TAFILA_POLICY = {
  minimumAttendancePercentage: 80,
  requiredTrainingHours: 140,
  requiredTasksRequired: true,
  postAssessmentRequired: true,
  professionalEvaluationRequired: true,
  minimumPassingScore: 80,
  attendanceWeight: 20,
  tasksWeight: 40,
  postAssessmentWeight: 20,
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

function taskRow(title, percent, { accepted = true, score = percent, max = 100 } = {}) {
  return {
    taskId: title,
    title,
    reviewStatus: accepted ? 'graded' : null,
    manualScore: accepted ? score : null,
    maxScore: accepted ? max : null,
  };
}

function tafilaInput(overrides = {}) {
  return {
    attendancePercentage: 90,
    completedHours: 140,
    requiredHours: 140,
    preAssessmentScore: 70,
    postAssessmentScore: 85,
    supervisorRatings: FULL_RATINGS,
    requiredTaskRows: [
      taskRow('t1', 92),
      taskRow('t2', 92),
      taskRow('t3', 92),
      taskRow('t4', 92),
    ],
    requiredTaskCount: 4,
    acceptedTaskCount: 4,
    ...overrides,
  };
}

describe('Tafila 20/20/40/20 qualification', () => {
  it('validates Tafila weights as 100', () => {
    const check = validatePolicyWeights(TAFILA_POLICY);
    assert.equal(check.ok, true);
    assert.equal(check.total, 100);
  });

  it('computes the exact 89.4 formula from component percentages', () => {
    assert.equal(pointsFromPercent(90, 20), 18);
    assert.equal(pointsFromPercent(85, 20), 17);
    assert.equal(pointsFromPercent(92, 40), 36.8);
    assert.equal(pointsFromPercent(88, 20), 17.6);
    assert.equal(round1(18 + 17 + 36.8 + 17.6), 89.4);
  });

  it('scores attendance, post, and tasks to the documented contributions', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput(),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(result.attendanceComponentScore, 18);
    assert.equal(result.postAssessmentComponentScore, 17);
    assert.equal(result.tasksComponentScore, 36.8);
    assert.equal(result.scoreComponents.tasks.rawPercentage, 92);
    assert.equal(result.scorePassed, result.finalScore >= 80);
    assert.ok(result.finalScore != null);
    assert.equal(result.finalScore, round1(18 + 17 + 36.8 + result.professionalComponentScore));
  });

  it('fails a complete score below 80', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 75,
        requiredTaskRows: [taskRow('t1', 80), taskRow('t2', 80), taskRow('t3', 80), taskRow('t4', 80)],
        supervisorRatings: {
          thinkingAndInitiative: 3,
          problemSolving: 3,
          teamwork: 3,
          professionalConduct: 3,
          supervisorCooperation: 3,
          rulesCompliance: 3,
        },
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    if (result.finalScore === 79) {
      assert.equal(result.scorePassed, false);
      assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
      assert.ok(result.eligibilityReasons.includes(GATE_REASONS.FINAL_SCORE_BELOW_MINIMUM));
      assert.ok(result.eligibilityReasonLabels.some((line) => line.includes('80')));
    }
    assert.equal(result.attendanceComponentScore, 20);
    assert.equal(result.postAssessmentComponentScore, 15);
    assert.equal(result.tasksComponentScore, 32);
  });

  it('keeps scorePassed when hours fail but blocks eligibility', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        completedHours: 120,
        requiredTaskRows: [taskRow('t1', 100), taskRow('t2', 100), taskRow('t3', 100), taskRow('t4', 100)],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.ok(result.finalScore >= 80);
    assert.equal(result.scorePassed, true);
    assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_HOURS_NOT_COMPLETED));
    assert.ok(result.eligibilityReasonLabels.some((line) => line.includes('120') && line.includes('140')));
  });

  it('blocks eligibility when attendance is below 80 even if score is high', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 75,
        postAssessmentScore: 100,
        requiredTaskRows: [taskRow('t1', 100), taskRow('t2', 100), taskRow('t3', 100), taskRow('t4', 100)],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(result.attendanceComponentScore, 15);
    assert.ok(result.finalScore == null || result.finalScore >= 80 || result.finalScore < 80);
    assert.equal(result.mandatoryRequirements.attendanceRequirementMet, false);
    assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.MINIMUM_ATTENDANCE_NOT_ACHIEVED));
  });

  it('treats a missing required task as 0 in the average and incomplete', () => {
    const tasks = computeTasksComponent(
      {
        requiredTaskRows: [
          taskRow('t1', 90),
          taskRow('t2', 80),
          taskRow('t3', 100),
          { taskId: 't4', title: 't4', reviewStatus: null, manualScore: null, maxScore: null },
        ],
        requiredTaskCount: 4,
      },
      TAFILA_POLICY
    );
    assert.equal(tasks.averagePercent, 67.5);
    assert.equal(tasks.points, 27);
    assert.equal(tasks.completed, false);
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        requiredTaskRows: [
          taskRow('t1', 90),
          taskRow('t2', 80),
          taskRow('t3', 100),
          { taskId: 't4', title: 't4', reviewStatus: 'rejected', manualScore: null, maxScore: null },
        ],
        acceptedTaskCount: 3,
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(result.tasksComponentScore, 27);
    // Score is >= 80 with partial submissions → Tafila waiver makes eligibility pass.
    assert.ok(result.finalScore >= 80);
    assert.equal(result.mandatoryRequirements.partialTasksWaiverApplied, true);
    assert.equal(result.mandatoryRequirements.requiredTasksCompleted, true);
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
  });

  it('normalizes behavior 45/50 to 18/20', () => {
    const totals = professionalTotals(
      {
        criterion1: 5,
        criterion2: 5,
        criterion3: 5,
        criterion4: 5,
        criterion5: 5,
        criterion6: 4,
        criterion7: 4,
        criterion8: 4,
        criterion9: 4,
        criterion10: 4,
      },
      { required: true }
    );
    assert.equal(totals.total, 45);
    assert.equal(totals.percentage, 90);
    assert.equal(pointsFromPercent(90, 20), 18);
  });

  it('does not renormalize a missing behavior component', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        requiredTaskRows: [taskRow('t1', 100), taskRow('t2', 100), taskRow('t3', 100), taskRow('t4', 100)],
        supervisorRatings: null,
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(result.finalScore, null);
    assert.notEqual(result.finalScore, 100);
    assert.notEqual(result.finalScore, 80);
    assert.equal(result.scoreStatus, 'INCOMPLETE');
    assert.ok(['NEEDS_REVIEW', 'NOT_ELIGIBLE'].includes(result.eligibilityStatus));
  });

  it('uses the 80 boundary on the canonical rounded score', () => {
    assert.equal(79.9 >= 80, false);
    assert.equal(80.0 >= 80, true);
    assert.equal(80.1 >= 80, true);
    assert.equal(round1(79.94), 79.9);
    assert.equal(round1(79.95), 80);
    assert.equal(round1(80.04), 80);
    assert.equal(round1(80.06), 80.1);
  });

  it('does not apply a separate post >= 80 gate', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 75,
        requiredTaskRows: [taskRow('t1', 100), taskRow('t2', 100), taskRow('t3', 100), taskRow('t4', 100)],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          minimum_post_assessment_score: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(result.postAssessmentComponentScore, 15);
    assert.ok(!result.eligibilityReasons.includes('post_assessment_below_minimum'));
  });

  it('applies zero-participation only when pre is missing AND zero submitted tasks', () => {
    const zp = calculateFieldTrainingFinalQualification(
      tafilaInput({
        preAssessmentScore: null,
        attendancePercentage: 100,
        postAssessmentScore: null,
        supervisorRatings: null,
        requiredTaskRows: [
          taskRow('t1', 0, { accepted: false }),
          taskRow('t2', 0, { accepted: false }),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
        student: { university_student_number: '999999999999' },
      }
    );
    assert.equal(zp.zeroParticipationApplied, true);
    assert.equal(zp.finalScore, 0);
    assert.equal(zp.attendanceComponentScore, 0);
    assert.equal(zp.tasksComponentScore, 0);
    assert.equal(zp.recordedAttendancePercent, 100);
    assert.equal(zp.scoreComponents.attendance.evaluationAttendancePercentage, 0);
    assert.equal(zp.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(zp.eligibilityReasons.includes(GATE_REASONS.ZERO_PARTICIPATION));

    const hasPreNoTasks = calculateFieldTrainingFinalQualification(
      tafilaInput({
        preAssessmentScore: 70,
        requiredTaskRows: [
          taskRow('t1', 0, { accepted: false }),
          taskRow('t2', 0, { accepted: false }),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(hasPreNoTasks.zeroParticipationApplied, false);
    assert.notEqual(hasPreNoTasks.attendanceComponentScore, 0);

    const noPreHasTasks = calculateFieldTrainingFinalQualification(
      tafilaInput({
        preAssessmentScore: null,
        requiredTaskRows: [
          taskRow('t1', 90),
          taskRow('t2', 80),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.equal(noPreHasTasks.zeroParticipationApplied, false);
    assert.equal(noPreHasTasks.tasksComponentScore, 17);
    assert.equal(noPreHasTasks.eligibilityStatus, 'NOT_ELIGIBLE');
  });

  it('forces Laith override by university number while preserving marks', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        requiredTaskRows: [
          taskRow('t1', 90),
          taskRow('t2', 80),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
        student: { university_student_number: '320230601066' },
      }
    );
    assert.equal(result.zeroParticipationApplied, false);
    assert.ok(result.finalScore != null && result.finalScore > 0);
    assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.equal(result.eligibilityOverride?.universityStudentNumber, '320230601066');
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.AUTHORIZED_ADMIN_ELIGIBILITY_DECISION));
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_SUBMISSION_MISSING));
  });

  it('allows eligibility with partial submitted tasks when final score >= 80', () => {
    // (100+100+100+0)/4 = 75% tasks → 30 pts; attendance 20; post 20; behavior 20 → 90
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        requiredTaskRows: [
          taskRow('t1', 100),
          taskRow('t2', 100),
          taskRow('t3', 100),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
        student: { university_student_number: '111111111111' },
      }
    );
    assert.equal(result.finalScore, 90);
    assert.equal(result.scoreComponents.tasks.acceptedCount, 3);
    assert.equal(result.mandatoryRequirements.partialTasksWaiverApplied, true);
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
    assert.ok(!result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_SUBMISSION_MISSING));
  });

  it('does not waive incomplete tasks when final score is below 80', () => {
    const result = calculateFieldTrainingFinalQualification(
      tafilaInput({
        attendancePercentage: 100,
        postAssessmentScore: 100,
        requiredTaskRows: [
          taskRow('t1', 90),
          taskRow('t2', 80),
          taskRow('t3', 0, { accepted: false }),
          taskRow('t4', 0, { accepted: false }),
        ],
      }),
      TAFILA_POLICY,
      {
        application: { training_status: 'in_training' },
        opportunity: {
          required_training_hours: 140,
          minimum_attendance_percentage: 80,
          requires_pre_assessment: true,
          requires_post_assessment: true,
          status: 'published',
        },
      }
    );
    assert.ok(result.finalScore != null && result.finalScore < 80);
    assert.equal(result.eligibilityStatus, 'NOT_ELIGIBLE');
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.REQUIRED_SUBMISSION_MISSING));
    assert.ok(result.eligibilityReasons.includes(GATE_REASONS.FINAL_SCORE_BELOW_MINIMUM));
  });
});
