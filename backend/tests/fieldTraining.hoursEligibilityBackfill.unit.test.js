'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATION_ID,
  TARGET_HOURS,
  isValidSubmittedAttempt,
  isValidTaskSubmission,
  qualifiesAttendance,
  canonicalAttendancePercent,
  proposedCompletedHours,
  needsMutation,
  evaluateEnrollment,
  buildDryRun,
} = require('../src/modules/fieldTraining/fieldTraining.hoursEligibilityBackfill');
const {
  mergeStoredHoursIntoProgress,
  buildHoursProgress,
  HOURS_STATUS,
  formatCompletedHoursLabelAr,
} = require('../src/modules/fieldTraining/fieldTraining.hours');

const OPP_A = '11111111-1111-4111-8111-111111111111';
const OPP_B = '22222222-2222-4222-8222-222222222222';
const STUDENT = '33333333-3333-4333-8333-333333333333';
const APP_A = '44444444-4444-4444-8444-444444444444';
const APP_B = '55555555-5555-4555-8555-555555555555';

function app(overrides = {}) {
  return {
    id: APP_A,
    opportunity_id: OPP_A,
    student_id: STUDENT,
    status: 'approved',
    training_status: 'post_assessment_completed',
    expelled_at: null,
    completed_training_hours: 22,
    completion_eligibility_status: 'ineligible',
    ...overrides,
  };
}

function validAttempt(id = 'pre-1') {
  return { id, submitted_at: new Date('2026-08-01T10:00:00.000Z'), student_id: STUDENT };
}

function validTask(overrides = {}) {
  return {
    id: 'task-sub-1',
    application_id: APP_A,
    student_id: STUDENT,
    opportunity_id: OPP_A,
    review_status: 'submitted',
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluateEnrollment({
    application: app(),
    opportunity: { id: OPP_A },
    preAttempt: validAttempt('pre-1'),
    postAttempt: validAttempt('post-1'),
    taskSubmission: validTask(),
    attendedCountedSessions: 8,
    totalCountedSessions: 10,
    ...overrides,
  });
}

describe('hours eligibility backfill rules', () => {
  it('uses the stable operation identifier', () => {
    assert.equal(OPERATION_ID, 'FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1');
    assert.equal(TARGET_HOURS, 140);
  });

  it('counts submitted attempts and rejects drafts', () => {
    assert.equal(isValidSubmittedAttempt(validAttempt()), true);
    assert.equal(isValidSubmittedAttempt({ id: 'x', submitted_at: null }), false);
    assert.equal(isValidSubmittedAttempt(null), false);
  });

  it('counts submitted/under_review/graded/approved tasks and rejects revision/draft/cross-opportunity', () => {
    assert.equal(isValidTaskSubmission(validTask(), app()), true);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'under_review' }), app()), true);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'graded' }), app()), true);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'approved' }), app()), true);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'needs_revision' }), app()), false);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'pending' }), app()), false);
    assert.equal(isValidTaskSubmission(validTask({ review_status: 'rejected' }), app()), false);
    assert.equal(isValidTaskSubmission(validTask({ opportunity_id: OPP_B }), app()), false);
    assert.equal(isValidTaskSubmission(validTask({ student_id: 'other' }), app()), false);
  });

  it('requires exact 80% attendance and does not round 79.5% up', () => {
    assert.equal(qualifiesAttendance(8, 10), true);
    assert.equal(qualifiesAttendance(4, 5), true);
    assert.equal(qualifiesAttendance(0, 0), false);
    assert.equal(qualifiesAttendance(0, 10), false);
    assert.equal(qualifiesAttendance(79, 100), false);
    assert.equal(qualifiesAttendance(7999, 10000), false);
    assert.equal(canonicalAttendancePercent(8, 10), 80);
    assert.equal(canonicalAttendancePercent(79, 100), 79);
  });

  it('raises hours to 140 and preserves higher values', () => {
    assert.equal(proposedCompletedHours(22), 140);
    assert.equal(proposedCompletedHours(140), 140);
    assert.equal(proposedCompletedHours(180), 180);
    assert.equal(formatCompletedHoursLabelAr(140), '140 ساعة تدريبية تم إنجازها');
  });

  it('1. all four requirements: becomes eligible with at least 140 hours', () => {
    const result = evaluate();
    assert.equal(result.qualify, true);
    assert.equal(result.mutate, true);
    assert.equal(result.proposedHours, 140);
    assert.equal(result.proposedEligibility, 'eligible');
    assert.equal(result.hoursWouldIncrease, true);
  });

  it('2. missing pre-assessment remains unchanged', () => {
    const result = evaluate({ preAttempt: { id: 'pre', submitted_at: null } });
    assert.equal(result.qualify, false);
    assert.deepEqual(result.missing, ['pre_assessment']);
    assert.equal(result.mutate, false);
  });

  it('3. no valid task submission remains unchanged', () => {
    const result = evaluate({ taskSubmission: validTask({ review_status: 'needs_revision' }) });
    assert.equal(result.qualify, false);
    assert.ok(result.missing.includes('task_submission'));
  });

  it('4. missing post-assessment remains unchanged', () => {
    const result = evaluate({ postAttempt: null });
    assert.equal(result.qualify, false);
    assert.ok(result.missing.includes('post_assessment'));
  });

  it('5. attendance exactly 80% qualifies', () => {
    const result = evaluate({ attendedCountedSessions: 4, totalCountedSessions: 5 });
    assert.equal(result.qualify, true);
  });

  it('6. attendance 79.99% does not qualify', () => {
    const result = evaluate({ attendedCountedSessions: 7999, totalCountedSessions: 10000 });
    assert.equal(result.qualify, false);
    assert.ok(result.missing.includes('attendance_below_80'));
  });

  it('7. zero countable sessions does not qualify', () => {
    const result = evaluate({ attendedCountedSessions: 0, totalCountedSessions: 0 });
    assert.equal(result.qualify, false);
    assert.ok(result.missing.includes('zero_counted_sessions'));
  });

  it('8. data from another opportunity does not qualify', () => {
    const result = evaluate({
      taskSubmission: validTask({ opportunity_id: OPP_B }),
      postAttempt: { id: 'post-other', submitted_at: new Date(), student_id: STUDENT },
    });
    assert.equal(result.qualify, false);
    assert.ok(result.missing.includes('task_submission'));
  });

  it('9. cancelled or withdrawn enrollment is skipped', () => {
    const cancelled = evaluate({ application: app({ status: 'cancelled' }) });
    const rejected = evaluate({ application: app({ status: 'rejected' }) });
    assert.ok(cancelled.skipReasons.includes('enrollment_not_accepted'));
    assert.ok(rejected.skipReasons.includes('enrollment_not_accepted'));
    assert.equal(cancelled.qualify, false);
  });

  it('10. existing hours greater than 140 are preserved', () => {
    const result = evaluate({ application: app({ completed_training_hours: 180 }) });
    assert.equal(result.proposedHours, 180);
    assert.equal(result.hoursWouldIncrease, false);
    assert.equal(result.hoursAlreadyAtOrAboveTarget, true);
  });

  it('11. rerun produces zero unnecessary updates', () => {
    const result = evaluate({
      application: app({
        completed_training_hours: 140,
        completion_eligibility_status: 'eligible',
      }),
    });
    assert.equal(result.qualify, true);
    assert.equal(result.mutate, false);
    assert.equal(needsMutation(app({
      completed_training_hours: 140,
      completion_eligibility_status: 'eligible',
    }), 140), false);
  });

  it('12. university/opportunity isolation is enforced in dry-run joins', () => {
    const snapshot = {
      opportunities: [
        { id: OPP_A, title: 'A', status: 'in_progress', university_id: 'uni-a' },
        { id: OPP_B, title: 'B', status: 'in_progress', university_id: 'uni-b' },
      ],
      applications: [
        app(),
        app({
          id: APP_B,
          opportunity_id: OPP_B,
          completed_training_hours: 10,
        }),
      ],
      assessments: [
        { id: 'pre-a', opportunity_id: OPP_A, type: 'pre' },
        { id: 'post-a', opportunity_id: OPP_A, type: 'post' },
        { id: 'pre-b', opportunity_id: OPP_B, type: 'pre' },
        { id: 'post-b', opportunity_id: OPP_B, type: 'post' },
      ],
      attempts: [
        {
          id: 'pre-att-a',
          assessment_id: 'pre-a',
          application_id: APP_A,
          student_id: STUDENT,
          submitted_at: new Date(),
        },
        {
          id: 'post-att-a',
          assessment_id: 'post-a',
          application_id: APP_A,
          student_id: STUDENT,
          submitted_at: new Date(),
        },
      ],
      tasks: [
        { id: 'task-a', opportunity_id: OPP_A },
        { id: 'task-b', opportunity_id: OPP_B },
      ],
      submissions: [
        {
          id: 'sub-a',
          task_id: 'task-a',
          application_id: APP_A,
          student_id: STUDENT,
          review_status: 'approved',
        },
      ],
      sessions: [
        { id: 's1', opportunity_id: OPP_A, is_required: true },
        { id: 's2', opportunity_id: OPP_B, is_required: true },
      ],
      attendance: [
        {
          id: 'att-1',
          session_id: 's1',
          application_id: APP_A,
          student_id: STUDENT,
          status: 'present',
        },
      ],
    };

    const report = buildDryRun(snapshot);
    assert.equal(report.counters.opportunitiesScanned, 2);
    assert.equal(report.integrityErrorCount, 0);
    assert.equal(report.qualifyingCount, 1);
    assert.equal(report.mutations[0].applicationId, APP_A);
    assert.equal(report.mutations[0].opportunityId, OPP_A);
    assert.ok(report.counters.excluded.pre_assessment >= 1);
  });
});

describe('mergeStoredHoursIntoProgress', () => {
  it('prefers recorded hours when they exceed attendance hours', () => {
    const attendance = buildHoursProgress({ requiredHours: 140, completedMinutes: 22 * 60 });
    const merged = mergeStoredHoursIntoProgress(attendance, 140);
    assert.equal(merged.completed_training_hours, 140);
    assert.equal(merged.hours_completion_status, HOURS_STATUS.COMPLETED);
    assert.equal(merged.remaining_training_hours, 0);
  });

  it('does not reduce attendance hours that already exceed stored hours', () => {
    const attendance = buildHoursProgress({ requiredHours: 140, completedMinutes: 160 * 60 });
    const merged = mergeStoredHoursIntoProgress(attendance, 140);
    assert.equal(merged.completed_training_hours, 160);
  });
});
