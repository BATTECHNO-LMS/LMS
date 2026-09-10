/**
 * Field training P2 task presentation semantics (frontend).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTaskPresentation,
  hasRealSubmission,
  formatCountOf,
  formatScore,
} from '../src/features/fieldTraining/fieldTrainingTaskSemantics.js';

describe('field training P2 frontend task semantics', () => {
  it('does not treat a missing LMS row as submitted', () => {
    const presented = resolveTaskPresentation({ task: { id: 't3' }, submission: null });
    assert.equal(hasRealSubmission(null), false);
    assert.equal(presented.submitted, false);
    assert.equal(presented.submissionLabelAr, 'غير مسلّم');
    assert.equal(presented.evaluationLabelAr, 'لم يتم التقييم');
    assert.equal(presented.completed, false);
    assert.equal(presented.scoreLabelAr, 'لا توجد');
  });

  it('keeps submitted pending review separate from evaluated', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't1' },
      submission: { id: 's1', review_status: 'under_review', submitted_at: '2026-08-01T10:00:00.000Z' },
    });
    assert.equal(presented.submitted, true);
    assert.equal(presented.completed, false);
    assert.equal(presented.evaluationLabelAr, 'قيد التقييم');
    assert.equal(presented.overallLabelAr, 'قيد التقييم');
  });

  it('marks graded submissions as evaluated and completed', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't1' },
      submission: {
        id: 's1',
        review_status: 'graded',
        manual_score: 84,
        max_score: 100,
      },
    });
    assert.equal(presented.completed, true);
    assert.equal(presented.evaluationLabelAr, 'تم التقييم');
    assert.equal(presented.score, 84);
    assert.equal(formatScore(presented.score, presented.maxScore), '84 / 100');
  });

  it('keeps late as timing, not a submission status', () => {
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
  });

  it('maps returned submissions without calling them completed', () => {
    const presented = resolveTaskPresentation({
      task: { id: 't5' },
      submission: { id: 's5', review_status: 'needs_revision' },
    });
    assert.equal(presented.submitted, true);
    assert.equal(presented.completed, false);
    assert.equal(presented.evaluationLabelAr, 'تحتاج إعادة تسليم');
  });

  it('formats counts as Arabic من, not a slash pair', () => {
    assert.equal(formatCountOf(2, 4), '2 من 4');
  });
});
