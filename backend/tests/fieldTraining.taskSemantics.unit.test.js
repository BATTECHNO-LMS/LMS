'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTaskPresentation,
  hasRealSubmission,
  countOfAr,
  scoreTextAr,
} = require('../src/modules/fieldTraining/fieldTraining.taskSemantics');
const present = require('../src/utils/fieldTraining.reportPresentation');

describe('field training P2 task semantics', () => {
  it('treats a missing LMS row as not submitted and not evaluated', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't3', title: 'Task 3' },
      submission: null,
    });
    assert.equal(hasRealSubmission(null), false);
    assert.equal(presented.submitted, false);
    assert.equal(presented.submissionLabelAr, 'غير مسلّم');
    assert.equal(presented.evaluationLabelAr, 'لم يتم التقييم');
    assert.equal(presented.completed, false);
    assert.equal(presented.score, null);
    assert.equal(presented.scoreLabelAr, 'لا توجد');
    assert.equal(presented.submittedAtLabelAr, 'لا يوجد');
    assert.equal(presented.overallLabelAr, 'غير مسلّم');
  });

  it('does not treat overlay-only objects as real submissions', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't4' },
      submission: {},
      overlayScore: 80,
    });
    assert.equal(presented.submitted, false);
    assert.equal(presented.score, null);
  });

  it('keeps submitted-but-pending-review separate from evaluated', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't1' },
      submission: {
        id: 's1',
        review_status: 'pending',
        submitted_at: '2026-08-01T10:00:00.000Z',
      },
    });
    assert.equal(presented.submitted, true);
    assert.equal(presented.submissionLabelAr, 'مسلّم');
    assert.equal(presented.evaluationLabelAr, 'قيد التقييم');
    assert.equal(presented.completed, false);
    assert.equal(presented.overallLabelAr, 'قيد التقييم');
    assert.equal(presented.score, null);
  });

  it('marks graded and approved submissions as evaluated and completed', () => {
    const graded = resolveTaskPresentation({
      task: { id: 't1', title: 'Task 1' },
      submission: {
        id: 's1',
        review_status: 'graded',
        manual_score: 84,
        max_score: 100,
        submitted_at: '2026-08-01T10:00:00.000Z',
      },
    });
    assert.equal(graded.submitted, true);
    assert.equal(graded.evaluationLabelAr, 'تم التقييم');
    assert.equal(graded.completed, true);
    assert.equal(graded.overallLabelAr, 'مكتمل');
    assert.equal(graded.score, 84);
    assert.equal(scoreTextAr(graded.score, graded.maxScore), '84 / 100');
  });

  it('keeps late as timing, not as a submission status', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't2' },
      submission: {
        id: 's2',
        review_status: 'approved',
        manual_score: 78,
        max_score: 100,
        is_late: true,
      },
    });
    assert.equal(presented.submissionLabelAr, 'مسلّم');
    assert.equal(presented.evaluationLabelAr, 'تم التقييم');
    assert.equal(presented.timingLabelAr, 'متأخر');
    assert.equal(presented.score, 78);
  });

  it('uses overlay score only when a real evaluated submission is missing a LMS grade', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't1' },
      submission: { id: 's1', review_status: 'graded', max_score: 100 },
      overlayScore: 84,
    });
    assert.equal(presented.score, 84);
  });

  it('maps returned and rejected states to resubmission, not completed', () => {
    const returned = resolveTaskPresentation({
      submission: { id: 's3', review_status: 'needs_revision' },
    });
    assert.equal(returned.submitted, true);
    assert.equal(presentedOr(returned), true);
    assert.equal(returned.completed, false);
    assert.equal(returned.evaluationLabelAr, 'تحتاج إعادة تسليم');

    const rejected = resolveTaskPresentation({
      submission: { id: 's4', review_status: 'rejected' },
    });
    assert.equal(rejected.completed, false);
    assert.equal(rejected.evaluationLabelAr, 'تحتاج إعادة تسليم');
  });

  it('formats Arabic counts without slash reversal', () => {
    assert.equal(countOfAr(2, 4), '2 من 4');
    assert.equal(present.countOfHtml(2, 4), '2 من 4');
  });

  it('presents all required tasks including unsubmitted ones', () => {
    const items = require('../src/modules/fieldTraining/fieldTraining.taskSemantics').presentOpportunityTasks(
      [
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' },
        { id: 't3', title: 'Task 3' },
        { id: 't4', title: 'Task 4' },
      ],
      [
        { id: 's1', task_id: 't1', review_status: 'graded', manual_score: 84, max_score: 100 },
        { id: 's2', task_id: 't2', review_status: 'approved', manual_score: 78, max_score: 100 },
      ]
    );
    assert.equal(items.length, 4);
    assert.equal(items.filter((row) => row.submitted).length, 2);
    assert.equal(items.filter((row) => row.evaluationState === 'evaluated').length, 2);
    assert.equal(items[2].submissionLabelAr, 'غير مسلّم');
    assert.equal(items[2].scoreLabelAr, 'لا توجد');
  });

  it('maps result sources to human Arabic without exposing enums', () => {
    assert.equal(present.labelSourceHuman('AUTHORIZED_MANUAL_REVIEW'), 'مراجعة واعتماد نهائي');
    assert.equal(
      present.labelSourceHuman('AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT'),
      'نتيجة معتمدة بعد المراجعة'
    );
    assert.equal(present.labelSourceHuman('AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE'), 'قرار إداري معتمد');
    assert.equal(present.labelSourceHuman('EXCEL_BASELINE'), 'النتيجة النهائية المعتمدة');
    assert.equal(present.labelTrainingStatus('completed'), 'مكتمل');
    assert.equal(present.labelTrainingStatus('failed'), 'لم يجتز');
    assert.equal(present.labelTrainingStatus('expelled'), 'مستبعد من التدريب');
    assert.equal(present.labelApplicationStatus('approved'), 'معتمد');
  });
});

function presentedOr(presented) {
  return presented.submitted;
}
