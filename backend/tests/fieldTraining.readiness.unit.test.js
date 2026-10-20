'use strict';

const {
  READINESS_STATES,
  READINESS_REASONS,
  resolveFieldTrainingReadiness,
  resolveStudentNextAction,
} = require('../src/modules/fieldTraining/fieldTraining.readiness');

function baseQual(overrides = {}) {
  return {
    finalScore: 82,
    scorePassed: true,
    passingScore: 80,
    eligibilityStatus: 'NOT_ELIGIBLE',
    eligibilityReasons: [],
    scoreComponents: {
      attendance: { points: 18, maxPoints: 20 },
      postAssessment: { points: 17, maxPoints: 20 },
      tasks: { points: 31, maxPoints: 40 },
      behavior: { points: 16, maxPoints: 20 },
    },
    ...overrides,
  };
}

describe('fieldTraining readiness', () => {
  test('READY when eligible and letter pending', () => {
    const readiness = resolveFieldTrainingReadiness({
      application: {
        status: 'approved',
        training_status: 'eligible_for_completion',
        completion_eligibility_status: 'eligible',
        pre_assessment_score: 70,
        post_assessment_score: 85,
      },
      opportunity: {
        requires_pre_assessment: true,
        requires_post_assessment: true,
        required_training_hours: 80,
      },
      qualification: baseQual({ eligibilityStatus: 'ELIGIBLE', scorePassed: true }),
      hours: {
        required_training_hours: 80,
        completed_training_hours: 80,
        hours_completion_status: 'complete',
      },
      progressMetrics: {
        pre_assessment_score: 70,
        post_assessment_score: 85,
      },
    });
    expect(readiness.state).toBe(READINESS_STATES.READY);
    expect(readiness.reasons).toContain(READINESS_REASONS.LETTER_PENDING);
    expect(readiness.score.final).toBe(82);
    expect(readiness.score.components.attendance.max).toBe(20);
    expect(readiness.score.components.postAssessment.max).toBe(20);
    expect(readiness.score.components.tasks.max).toBe(40);
    expect(readiness.score.components.behavior.max).toBe(20);
  });

  test('score pass + hours fail → NOT_READY / NEARLY_READY with HOURS_INCOMPLETE', () => {
    const readiness = resolveFieldTrainingReadiness({
      application: {
        status: 'approved',
        training_status: 'in_training',
        pre_assessment_score: 70,
        post_assessment_score: 85,
      },
      opportunity: {
        requires_pre_assessment: true,
        requires_post_assessment: true,
        required_training_hours: 80,
      },
      qualification: baseQual({ scorePassed: true }),
      hours: {
        required_training_hours: 80,
        completed_training_hours: 74,
        hours_completion_status: 'incomplete',
      },
      progressMetrics: { pre_assessment_score: 70, post_assessment_score: 85 },
    });
    expect(readiness.reasons).toContain(READINESS_REASONS.HOURS_INCOMPLETE);
    expect([READINESS_STATES.NOT_READY, READINESS_STATES.NEARLY_READY]).toContain(readiness.state);
    expect(readiness.explanation_ar).toMatch(/ساعة/);
    expect(readiness.completion_requirements.hours.unit).toBe('hours');
  });

  test('POST incomplete is a blocker and next action', () => {
    const readiness = resolveFieldTrainingReadiness({
      application: {
        status: 'approved',
        training_status: 'task_submitted',
        pre_assessment_score: 70,
        post_assessment_score: null,
      },
      opportunity: {
        requires_pre_assessment: true,
        requires_post_assessment: true,
        required_training_hours: 80,
      },
      qualification: baseQual({ scorePassed: false, finalScore: 65 }),
      hours: {
        required_training_hours: 80,
        completed_training_hours: 80,
        hours_completion_status: 'complete',
      },
      progressMetrics: { pre_assessment_score: 70, post_assessment_score: null },
    });
    expect(readiness.reasons).toContain(READINESS_REASONS.POST_NOT_COMPLETED);
    const next = resolveStudentNextAction({ readiness, overdueTasks: [] });
    expect(next.key).toBe('complete_post_assessment');
  });

  test('PRE and hours never appear as scored points in readiness score object', () => {
    const readiness = resolveFieldTrainingReadiness({
      application: { status: 'approved', training_status: 'in_training', pre_assessment_score: 99 },
      opportunity: { requires_pre_assessment: true, requires_post_assessment: true, required_training_hours: 80 },
      qualification: baseQual(),
      hours: {
        required_training_hours: 80,
        completed_training_hours: 10,
        hours_completion_status: 'incomplete',
      },
      progressMetrics: { pre_assessment_score: 99, post_assessment_score: 85 },
    });
    expect(readiness.completion_requirements.pre.scored).toBe(false);
    expect(readiness.score.components).not.toHaveProperty('pre');
    expect(readiness.score.components).not.toHaveProperty('hours');
    expect(readiness.score.final).toBe(82);
  });
});
