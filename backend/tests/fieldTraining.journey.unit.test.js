'use strict';

const { buildFieldTrainingJourney, JOURNEY_STATES } = require('../src/modules/fieldTraining/fieldTraining.journey');

describe('fieldTraining journey', () => {
  test('only includes milestones that exist for the opportunity', () => {
    const journey = buildFieldTrainingJourney({
      application: {
        id: 'a1',
        status: 'approved',
        training_status: 'in_training',
        training_started_at: new Date().toISOString(),
        pre_assessment_score: null,
        post_assessment_score: null,
      },
      opportunity: {
        requires_pre_assessment: false,
        requires_post_assessment: true,
        required_training_hours: 80,
      },
      progressMetrics: {
        sessions_count: 0,
        required_sessions_count: 0,
        sessions_attended: 0,
        pre_assessment_score: null,
        post_assessment_score: null,
      },
      hours: {
        required_training_hours: 80,
        completed_training_hours: 10,
        hours_completion_status: 'incomplete',
      },
      lectures: [{ id: 'lec1', title: 'Lecture A', progress_percent: 0 }],
      tasks: [{ id: 't1', title: 'Task one', is_required: true, submitted: false }],
      readiness: { state: 'NOT_READY', reasons: ['POST_NOT_COMPLETED'], state_label_ar: 'غير مستوفٍ' },
    });

    const keys = journey.milestones.map((m) => m.key);
    expect(keys).not.toContain('pre_assessment');
    expect(keys).toContain('post_assessment');
    expect(keys).toContain('training_hours');
    expect(keys).toContain('recorded_lecture:lec1');
    expect(keys).toContain('task:t1');
    expect(keys).not.toContain('attendance_sessions');
    expect(journey.total_count).toBeGreaterThan(0);
    expect(journey.summary_ar).toMatch(/مراحل مكتملة/);
  });

  test('lecture milestone shows progress detail', () => {
    const journey = buildFieldTrainingJourney({
      application: { id: 'a1', status: 'approved', training_status: 'in_training' },
      opportunity: { requires_pre_assessment: false, requires_post_assessment: false },
      lectures: [{ id: 'lec1', title: 'L1', progress_percent: 65 }],
      readiness: { state: 'NOT_READY', reasons: [] },
    });
    const lec = journey.milestones.find((m) => m.key === 'recorded_lecture:lec1');
    expect(lec.detail_ar).toBe('65%');
    expect(lec.state).not.toBe(JOURNEY_STATES.COMPLETED);
  });

  test('hours detail uses ساعة not points', () => {
    const journey = buildFieldTrainingJourney({
      application: { id: 'a1', status: 'approved', training_status: 'in_training' },
      opportunity: { requires_pre_assessment: false, requires_post_assessment: false, required_training_hours: 80 },
      hours: {
        required_training_hours: 80,
        completed_training_hours: 74,
        hours_completion_status: 'incomplete',
      },
      readiness: { state: 'NEARLY_READY', reasons: ['HOURS_INCOMPLETE'] },
    });
    const hours = journey.milestones.find((m) => m.key === 'training_hours');
    expect(hours.detail_ar).toMatch(/ساعة/);
    expect(hours.detail_ar).not.toMatch(/points|درجة/);
  });
});
