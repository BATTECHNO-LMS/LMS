'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  mapTraineeTask,
  canSubmitTask,
} = require('../src/modules/trainingPrograms/trainingTaskWorkflow.service');

describe('mapTraineeTask', () => {
  it('keeps trainee list fields and latest submission', () => {
    const task = {
      id: 't1',
      title: 'مهمة 1',
      instructions: 'نفّذ',
      due_at: null,
      is_required: true,
      is_final_task: false,
      max_score: 10,
      allow_resubmit: true,
      max_attempts: 3,
      grading_mode: 'MANUAL',
      settings_json: { attachmentUrl: 'https://example.com/a.pdf' },
    };
    const mapped = mapTraineeTask(task, [
      { id: 's1', task_id: 't1', status: 'SUBMITTED', score: null, feedback: null, attempt_no: 1 },
      { id: 's2', task_id: 't1', status: 'GRADED', score: 8, feedback: 'جيد', attempt_no: 2 },
    ]);
    assert.equal(mapped.id, 't1');
    assert.equal(mapped.title, 'مهمة 1');
    assert.equal(mapped.attachmentUrl, 'https://example.com/a.pdf');
    assert.equal(mapped.attemptCount, 2);
    assert.equal(mapped.submission.id, 's2');
    assert.equal(mapped.submission.status, 'GRADED');
    assert.equal(mapped.submission.score, 8);
  });
});

describe('canSubmitTask', () => {
  it('allows first attempt', () => {
    assert.equal(canSubmitTask({ max_attempts: 3, allow_resubmit: false }, []), true);
  });

  it('blocks when max attempts reached', () => {
    const subs = [{ attempt_no: 1 }, { attempt_no: 2 }];
    assert.equal(canSubmitTask({ max_attempts: 2, allow_resubmit: true }, subs), false);
  });

  it('allows resubmit after revision request even if allow_resubmit is false', () => {
    const subs = [{ attempt_no: 1, status: 'REVISION_REQUESTED' }];
    assert.equal(canSubmitTask({ max_attempts: 3, allow_resubmit: false }, subs), true);
  });
});
