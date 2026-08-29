'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('path');
const {
  TASK_PROGRESS_STATUS,
  TASK_PROGRESS_LABEL_AR,
  SUCCESSFUL_TASK_REVIEW_STATUSES,
  UNSUCCESSFUL_TASK_REVIEW_STATUSES,
  isRequiredActiveTask,
  isTaskAssignedToStudent,
  submissionCountsTowardProgress,
  deriveTaskProgress,
  countProgressFromLoadedRows,
  formatProgressDisplay,
  requiredTaskWhere,
  successfulSubmissionWhere,
} = require('../src/modules/fieldTraining/fieldTraining.taskProgress');
const { mapStudentExcelRow } = require('../src/modules/fieldTraining/fieldTrainingStudentsExcel');

function approvedApp(overrides = {}) {
  return {
    id: 'app-1',
    opportunity_id: 'opp-1',
    student_id: 'student-1',
    status: 'approved',
    ...overrides,
  };
}

function requiredTask(id, opportunityId = 'opp-1', extra = {}) {
  return { id, opportunity_id: opportunityId, is_required: true, ...extra };
}

function submission(taskId, reviewStatus, extra = {}) {
  return {
    application_id: 'app-1',
    task_id: taskId,
    review_status: reviewStatus,
    ...extra,
  };
}

describe('field training required-task progress', () => {
  it('uses existing review_status enum values for success and failure', () => {
    assert.deepEqual([...SUCCESSFUL_TASK_REVIEW_STATUSES], [
      'pending',
      'submitted',
      'under_review',
      'graded',
      'approved',
    ]);
    assert.deepEqual([...UNSUCCESSFUL_TASK_REVIEW_STATUSES], ['needs_revision', 'rejected']);
  });

  it('never marks completed when the opportunity has zero required tasks', () => {
    const progress = deriveTaskProgress({
      applicationStatus: 'approved',
      totalRequired: 0,
      submittedRequired: 0,
    });
    assert.equal(progress.status, TASK_PROGRESS_STATUS.NO_REQUIRED_TASKS);
    assert.notEqual(progress.status, TASK_PROGRESS_STATUS.COMPLETED);
    assert.equal(progress.display, 'لا توجد مهمات مطلوبة');
    assert.equal(progress.label_ar, TASK_PROGRESS_LABEL_AR.no_required_tasks);
  });

  it('assigns لم يبدأ المهمات when no required tasks are submitted', () => {
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1'), requiredTask('t2')],
      submissions: [],
    });
    assert.equal(progress.status, 'not_started');
    assert.equal(progress.display, '0 / 2 — لم يبدأ المهمات');
    assert.equal(progress.submitted_required, 0);
    assert.equal(progress.total_required, 2);
  });

  it('assigns قيد إنجاز المهمات for a partial submission', () => {
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1'), requiredTask('t2'), requiredTask('t3')],
      submissions: [submission('t1', 'submitted')],
    });
    assert.equal(progress.status, 'in_progress');
    assert.equal(progress.display, '1 / 3 — قيد إنجاز المهمات');
  });

  it('assigns أكمل المهمات when every required task is successfully submitted', () => {
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1'), requiredTask('t2')],
      submissions: [
        submission('t1', 'approved'),
        submission('t2', 'graded', { is_late: true }),
      ],
    });
    assert.equal(progress.status, 'completed');
    assert.equal(progress.display, '2 / 2 — أكمل المهمات');
  });

  it('ignores optional tasks in both required and submitted counts', () => {
    assert.equal(isRequiredActiveTask({ is_required: false }), false);
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [
        requiredTask('t1'),
        { id: 'optional', opportunity_id: 'opp-1', is_required: false },
      ],
      submissions: [
        submission('t1', 'submitted'),
        submission('optional', 'approved'),
      ],
    });
    assert.equal(progress.total_required, 1);
    assert.equal(progress.submitted_required, 1);
    assert.equal(progress.status, 'completed');
  });

  it('does not count missing, draft, returned, rejected, or cancelled submissions', () => {
    assert.equal(submissionCountsTowardProgress(null), false);
    assert.equal(submissionCountsTowardProgress({ review_status: 'draft' }), false);
    assert.equal(submissionCountsTowardProgress({ review_status: 'needs_revision' }), false);
    assert.equal(submissionCountsTowardProgress({ review_status: 'rejected' }), false);
    assert.equal(submissionCountsTowardProgress({ review_status: 'cancelled' }), false);
    assert.equal(submissionCountsTowardProgress({ review_status: 'approved', deleted_at: new Date() }), false);

    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1'), requiredTask('t2'), requiredTask('t3')],
      submissions: [
        submission('t1', 'needs_revision'),
        submission('t2', 'rejected'),
      ],
    });
    assert.equal(progress.status, 'not_started');
    assert.equal(progress.submitted_required, 0);
  });

  it('counts a resubmission after return when the review_status becomes successful', () => {
    const returned = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1')],
      submissions: [submission('t1', 'needs_revision')],
    });
    assert.equal(returned.status, 'not_started');

    const resubmitted = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1')],
      submissions: [submission('t1', 'submitted')],
    });
    assert.equal(resubmitted.status, 'completed');
    assert.equal(resubmitted.display, '1 / 1 — أكمل المهمات');
  });

  it('does not count tasks or submissions that belong to another opportunity', () => {
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1', 'opp-1'), requiredTask('other', 'opp-2')],
      submissions: [submission('other', 'approved')],
    });
    assert.equal(progress.total_required, 1);
    assert.equal(progress.submitted_required, 0);
    assert.equal(progress.status, 'not_started');
  });

  it('does not count a submission whose application_id belongs to a different student row', () => {
    const progress = countProgressFromLoadedRows({
      application: approvedApp(),
      tasks: [requiredTask('t1')],
      submissions: [submission('t1', 'approved', { application_id: 'app-other' })],
    });
    assert.equal(progress.submitted_required, 0);
    assert.equal(progress.status, 'not_started');
  });

  it('counts pending, submitted, under_review, graded, and approved as successful', () => {
    for (const status of SUCCESSFUL_TASK_REVIEW_STATUSES) {
      assert.equal(submissionCountsTowardProgress({ review_status: status }), true, status);
    }
  });

  it('hides calculated progress for pending or rejected applications that are not enrolled', () => {
    const pending = deriveTaskProgress({
      applicationStatus: 'pending',
      totalRequired: 4,
      submittedRequired: 0,
    });
    assert.equal(pending.enrolled, false);
    assert.equal(pending.status, null);
    assert.equal(pending.display, null);

    const rejected = deriveTaskProgress({
      applicationStatus: 'rejected',
      totalRequired: 4,
      submittedRequired: 4,
    });
    assert.equal(rejected.enrolled, false);
    assert.equal(rejected.display, null);
  });

  it('shows cancelled as the primary status while preserving the calculated counts', () => {
    const progress = deriveTaskProgress({
      applicationStatus: 'cancelled',
      totalRequired: 8,
      submittedRequired: 3,
    });
    assert.equal(progress.primary_status, 'cancelled');
    assert.equal(progress.status, 'in_progress');
    assert.equal(progress.display, '3 / 8 — ملغى');
  });

  it('preserves the calculated task status for completed training and archived opportunities', () => {
    const completed = deriveTaskProgress({
      applicationStatus: 'approved',
      opportunityStatus: 'in_progress',
      totalRequired: 8,
      submittedRequired: 8,
    });
    assert.equal(completed.status, 'completed');
    assert.equal(completed.display, '8 / 8 — أكمل المهمات');

    const archived = deriveTaskProgress({
      applicationStatus: 'approved',
      opportunityStatus: 'archived',
      totalRequired: 5,
      submittedRequired: 2,
    });
    assert.equal(archived.primary_status, 'in_progress');
    assert.equal(archived.display, '2 / 5 — قيد إنجاز المهمات');
    assert.notEqual(archived.primary_status, 'cancelled');
  });

  it('treats opportunity-wide tasks as assigned to every enrolled student', () => {
    assert.equal(isTaskAssignedToStudent(requiredTask('t1'), 'student-1'), true);
    assert.equal(
      isTaskAssignedToStudent(
        { id: 't2', is_required: true, assigned_student_ids: ['student-2'] },
        'student-1'
      ),
      false
    );
  });

  it('batch query helpers isolate required tasks and successful submissions by opportunity', () => {
    const taskWhere = requiredTaskWhere(['opp-1', 'opp-2']);
    assert.deepEqual(taskWhere.opportunity_id, { in: ['opp-1', 'opp-2'] });
    assert.equal(taskWhere.is_required, true);

    const subWhere = successfulSubmissionWhere(['app-1'], ['opp-1']);
    assert.deepEqual(subWhere.application_id, { in: ['app-1'] });
    assert.deepEqual(subWhere.review_status, { in: [...SUCCESSFUL_TASK_REVIEW_STATUSES] });
    assert.deepEqual(subWhere.field_training_tasks.opportunity_id, { in: ['opp-1'] });
    assert.equal(subWhere.field_training_tasks.is_required, true);
  });

  it('formats progress as submitted / total — Arabic status', () => {
    assert.equal(
      formatProgressDisplay('completed', 8, 8),
      '8 / 8 — أكمل المهمات'
    );
    assert.equal(formatProgressDisplay('no_required_tasks', 0, 0), 'لا توجد مهمات مطلوبة');
  });
});

describe('field training task progress authorization wiring', () => {
  it('attaches derived progress only after existing student and manage access checks', () => {
    const serviceSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTraining.service.js'),
      'utf8'
    );
    assert.match(serviceSrc, /assertStudentCanAccessOpportunity\(row, studentId\)/);
    assert.match(serviceSrc, /my_task_progress: myTaskProgress/);
    assert.match(serviceSrc, /assertManageOpportunityAccess/);
    assert.match(serviceSrc, /calculateTaskProgressForApplications/);
    assert.match(serviceSrc, /task_progress: progressByApp\.get\(app\.id\)/);
  });

  it('keeps university-scoped report and excel exports on the derived payload', () => {
    const reportSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingReport.repository.js'),
      'utf8'
    );
    const excelSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingStudentsExcel.js'),
      'utf8'
    );
    assert.match(reportSrc, /task_progress: progress/);
    assert.match(excelSrc, /تقدم المهمات/);
    assert.match(excelSrc, /task_progress\?\.display/);
    const evalSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingEvaluation.service.js'),
      'utf8'
    );
    const payloadSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingEvaluation.payload.js'),
      'utf8'
    );
    assert.match(evalSrc, /attachTaskProgressToReportRows/);
    assert.match(evalSrc, /calculateTaskProgressForApplications/);
    assert.doesNotMatch(payloadSrc, /task_progress/);
  });
});

describe('field training students excel task progress', () => {
  it('writes the Arabic status and submitted/total progress', () => {
    const row = mapStudentExcelRow(
      {
        student_name: 'طالب',
        student_email: '202312345@university.edu.jo',
        specialty_label: 'هندسة',
        university_name: 'جامعة',
        opportunity_title: 'فرصة',
        training_organization: 'جهة',
        application_status: 'approved',
        training_status: 'in_training',
        eligibility_status: 'pending',
        task_progress: {
          status: 'completed',
          display: '8 / 8 — أكمل المهمات',
        },
      },
      0
    );
    assert.equal(row.taskProgress, '8 / 8 — أكمل المهمات');
  });
});
