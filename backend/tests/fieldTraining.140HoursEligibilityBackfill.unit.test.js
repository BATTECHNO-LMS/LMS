'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATION_ID,
  TARGET_HOURS,
  evaluateEnrollment,
  attendanceMeetsThreshold,
  collectIntegrityErrors,
  summarizeEvaluations,
  applicationUpdateData,
} = require('../scripts/lib/fieldTraining140HoursEligibilityBackfill');

const OPP_A = 'opp-a';
const OPP_B = 'opp-b';
const STUDENT = 'student-1';
const APP = 'app-1';

function enrollment(overrides = {}) {
  return {
    application: {
      id: APP,
      opportunity_id: OPP_A,
      student_id: STUDENT,
      status: 'approved',
      training_status: 'in_training',
      completed_training_hours: 40,
      completion_eligibility_status: 'pending',
      expelled_at: null,
      ...overrides.application,
    },
    opportunity: {
      id: OPP_A,
      university_id: 'uni-1',
      status: 'published',
      ...overrides.opportunity,
    },
    assessments: overrides.assessments || [
      { id: 'pre-1', opportunity_id: OPP_A, type: 'pre' },
      { id: 'post-1', opportunity_id: OPP_A, type: 'post' },
    ],
    attempts: overrides.attempts || [
      {
        id: 'pre-att',
        assessment_id: 'pre-1',
        application_id: APP,
        student_id: STUDENT,
        submitted_at: new Date('2026-08-01'),
        score: 50,
      },
      {
        id: 'post-att',
        assessment_id: 'post-1',
        application_id: APP,
        student_id: STUDENT,
        submitted_at: new Date('2026-08-20'),
        score: 40,
      },
    ],
    tasks: overrides.tasks || [{ id: 'task-1', opportunity_id: OPP_A }],
    submissions: overrides.submissions || [
      {
        id: 'sub-1',
        task_id: 'task-1',
        application_id: APP,
        student_id: STUDENT,
        review_status: 'submitted',
        submitted_at: new Date('2026-08-10'),
        file_path: '/files/report.pdf',
      },
    ],
    sessions: overrides.sessions || [
      { id: 's1', opportunity_id: OPP_A, is_required: true },
      { id: 's2', opportunity_id: OPP_A, is_required: true },
      { id: 's3', opportunity_id: OPP_A, is_required: true },
      { id: 's4', opportunity_id: OPP_A, is_required: true },
      { id: 's5', opportunity_id: OPP_A, is_required: true },
    ],
    attendanceRows: overrides.attendanceRows || [
      { application_id: APP, student_id: STUDENT, session_id: 's1', status: 'present' },
      { application_id: APP, student_id: STUDENT, session_id: 's2', status: 'present' },
      { application_id: APP, student_id: STUDENT, session_id: 's3', status: 'late' },
      { application_id: APP, student_id: STUDENT, session_id: 's4', status: 'excused' },
    ],
  };
}

describe('field-training 140 hours eligibility backfill rules', () => {
  it('qualifies when all four conditions are met and raises hours to 140', () => {
    const result = evaluateEnrollment(enrollment());
    assert.equal(result.qualifies, true);
    assert.equal(result.needsUpdate, true);
    assert.equal(result.proposedHours, TARGET_HOURS);
    assert.equal(result.proposedEligibility, 'eligible');
    assert.equal(result.preAttemptId, 'pre-att');
    assert.equal(result.taskSubmissionId, 'sub-1');
    assert.equal(result.postAttemptId, 'post-att');
    assert.equal(result.attendance.percent, 80);
  });

  it('does not require a passing assessment grade', () => {
    const result = evaluateEnrollment(
      enrollment({
        attempts: [
          {
            id: 'pre-att',
            assessment_id: 'pre-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 10,
          },
          {
            id: 'post-att',
            assessment_id: 'post-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 5,
          },
        ],
      })
    );
    assert.equal(result.qualifies, true);
  });

  it('leaves the enrollment unchanged when the pre-assessment is missing', () => {
    const result = evaluateEnrollment(enrollment({ attempts: [
      {
        id: 'post-att',
        assessment_id: 'post-1',
        application_id: APP,
        student_id: STUDENT,
        submitted_at: new Date(),
        score: 80,
      },
    ] }));
    assert.equal(result.qualifies, false);
    assert.deepEqual(result.missing, ['pre_assessment']);
    assert.equal(result.proposedHours, 40);
    assert.equal(result.proposedEligibility, 'pending');
    assert.equal(result.needsUpdate, false);
  });

  it('ignores in-progress and draft assessment attempts', () => {
    const result = evaluateEnrollment(
      enrollment({
        attempts: [
          {
            id: 'pre-draft',
            assessment_id: 'pre-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: null,
            score: null,
          },
          {
            id: 'post-att',
            assessment_id: 'post-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 80,
          },
        ],
      })
    );
    assert.equal(result.qualifies, false);
    assert.ok(result.missing.includes('pre_assessment'));
  });

  it('leaves the enrollment unchanged when there is no valid task submission', () => {
    const result = evaluateEnrollment(enrollment({ submissions: [] }));
    assert.equal(result.qualifies, false);
    assert.ok(result.missing.includes('task_submission'));
  });

  it('rejects a returned-for-revision submission without a valid resubmission', () => {
    const result = evaluateEnrollment(
      enrollment({
        submissions: [
          {
            id: 'sub-1',
            task_id: 'task-1',
            application_id: APP,
            student_id: STUDENT,
            review_status: 'needs_revision',
            submitted_at: new Date(),
            file_path: '/files/report.pdf',
          },
        ],
      })
    );
    assert.equal(result.qualifies, false);
    assert.ok(result.missing.includes('task_submission'));
  });

  it('leaves the enrollment unchanged when the post-assessment is missing', () => {
    const result = evaluateEnrollment(
      enrollment({
        attempts: [
          {
            id: 'pre-att',
            assessment_id: 'pre-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 80,
          },
        ],
      })
    );
    assert.ok(result.missing.includes('post_assessment'));
    assert.equal(result.needsUpdate, false);
  });

  it('qualifies at exactly 80% attendance and rejects 79.99% without rounding up', () => {
    const exact = attendanceMeetsThreshold(4, 5);
    assert.equal(exact.ok, true);
    assert.equal(exact.percent, 80);

    const below = attendanceMeetsThreshold(7999, 10000);
    assert.equal(below.ok, false);
    assert.ok(below.percent < 80);
    assert.equal(Math.round(below.percent * 100) / 100, 79.99);

    const half = attendanceMeetsThreshold(159, 200);
    assert.equal(half.percent, 79.5);
    assert.equal(half.ok, false);
  });

  it('does not qualify when there are zero countable sessions', () => {
    const result = evaluateEnrollment(enrollment({ sessions: [], attendanceRows: [] }));
    assert.equal(result.qualifies, false);
    assert.ok(result.missing.includes('zero_sessions'));
  });

  it('does not combine assessment, task, or attendance data from another opportunity', () => {
    const result = evaluateEnrollment(
      enrollment({
        assessments: [
          { id: 'pre-1', opportunity_id: OPP_A, type: 'pre' },
          { id: 'post-other', opportunity_id: OPP_B, type: 'post' },
        ],
        attempts: [
          {
            id: 'pre-att',
            assessment_id: 'pre-1',
            application_id: APP,
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 80,
          },
          {
            id: 'post-other',
            assessment_id: 'post-other',
            application_id: 'app-other',
            student_id: STUDENT,
            submitted_at: new Date(),
            score: 90,
          },
        ],
      })
    );
    assert.ok(result.missing.includes('post_assessment'));
  });

  it('skips cancelled opportunities and withdrawn enrollments', () => {
    const cancelledOpp = evaluateEnrollment(
      enrollment({ opportunity: { id: OPP_A, university_id: 'uni-1', status: 'cancelled' } })
    );
    assert.equal(cancelledOpp.skipReason, 'opportunity_cancelled');
    assert.equal(cancelledOpp.needsUpdate, false);

    const withdrawn = evaluateEnrollment(enrollment({ application: {
      id: APP,
      opportunity_id: OPP_A,
      student_id: STUDENT,
      status: 'cancelled',
      training_status: 'none',
      completed_training_hours: 40,
      completion_eligibility_status: 'pending',
    } }));
    assert.equal(withdrawn.skipReason, 'enrollment_not_accepted');
  });

  it('preserves completed hours already above 140', () => {
    const result = evaluateEnrollment(
      enrollment({
        application: {
          id: APP,
          opportunity_id: OPP_A,
          student_id: STUDENT,
          status: 'approved',
          training_status: 'in_training',
          completed_training_hours: 168,
          completion_eligibility_status: 'pending',
        },
      })
    );
    assert.equal(result.qualifies, true);
    assert.equal(result.proposedHours, 168);
    assert.equal(result.hoursPreservedAboveTarget, true);
    assert.equal(result.proposedEligibility, 'eligible');
  });

  it('is idempotent when the student is already eligible with at least 140 hours', () => {
    const result = evaluateEnrollment(
      enrollment({
        application: {
          id: APP,
          opportunity_id: OPP_A,
          student_id: STUDENT,
          status: 'approved',
          training_status: 'eligible_for_completion',
          completed_training_hours: 140,
          completion_eligibility_status: 'eligible',
        },
      })
    );
    assert.equal(result.qualifies, true);
    assert.equal(result.alreadyAtTarget, true);
    assert.equal(result.needsUpdate, false);
    const data = applicationUpdateData(result, { id: 'admin' });
    assert.equal(data.completed_training_hours, 140);
    assert.equal(data.eligibility_reason.operation, OPERATION_ID);
  });

  it('flags duplicate enrollments and cross-opportunity joins', () => {
    const errors = collectIntegrityErrors({
      applications: [
        { id: APP, opportunity_id: OPP_A, student_id: STUDENT },
        { id: 'app-dup', opportunity_id: OPP_A, student_id: STUDENT },
      ],
      assessments: [{ id: 'pre-1', opportunity_id: OPP_B, type: 'pre' }],
      attempts: [
        {
          id: 'pre-att',
          assessment_id: 'pre-1',
          application_id: APP,
          student_id: STUDENT,
        },
      ],
      tasks: [{ id: 'task-1', opportunity_id: OPP_B }],
      submissions: [
        { id: 'sub-1', task_id: 'task-1', application_id: APP, student_id: STUDENT },
      ],
      sessions: [{ id: 's1', opportunity_id: OPP_B }],
      attendanceRows: [
        { id: 'att-1', application_id: APP, student_id: STUDENT, session_id: 's1' },
      ],
    });
    assert.ok(errors.some((row) => row.code === 'duplicate_enrollment'));
    assert.ok(errors.some((row) => row.code === 'attempt_cross_opportunity'));
    assert.ok(errors.some((row) => row.code === 'submission_cross_opportunity'));
    assert.ok(errors.some((row) => row.code === 'attendance_cross_opportunity'));
  });

  it('summarizes exclusions without mixing skipped enrollments into qualifying counts', () => {
    const qualifying = evaluateEnrollment(enrollment());
    const missingPre = evaluateEnrollment(enrollment({ attempts: [] }));
    const skipped = evaluateEnrollment(
      enrollment({ application: {
        id: 'app-2',
        opportunity_id: OPP_A,
        student_id: 'student-2',
        status: 'rejected',
        training_status: 'none',
        completed_training_hours: 0,
        completion_eligibility_status: 'pending',
      } })
    );
    const summary = summarizeEvaluations([qualifying, missingPre, skipped], {
      opportunitiesScanned: 1,
      integrityErrors: [],
    });
    assert.equal(summary.enrollmentsScanned, 3);
    assert.equal(summary.qualifying, 1);
    assert.equal(summary.exclusions.pre_assessment, 1);
    assert.equal(summary.exclusions.enrollment_not_accepted, 1);
    assert.equal(summary.integrityErrorCount, 0);
  });
});
