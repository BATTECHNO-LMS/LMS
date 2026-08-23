import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { trainingProgramStatusLabel } from '../src/features/training/trainingProgramStatus.js';
import { trainingTaskStatusLabel } from '../src/features/training/trainingTaskStatus.js';

describe('training status labels', () => {
  it('maps program lifecycle statuses to Arabic', () => {
    assert.equal(trainingProgramStatusLabel('DRAFT'), 'مسودة');
    assert.equal(trainingProgramStatusLabel('REGISTRATION_OPEN'), 'التسجيل مفتوح');
    assert.equal(trainingProgramStatusLabel('IN_PROGRESS'), 'قيد التنفيذ');
    assert.equal(trainingProgramStatusLabel(null), '—');
  });

  it('maps task submission statuses to Arabic', () => {
    assert.equal(trainingTaskStatusLabel('SUBMITTED'), 'مُسلَّمة');
    assert.equal(trainingTaskStatusLabel('REVISION_REQUESTED'), 'مطلوب تعديل');
    assert.equal(trainingTaskStatusLabel('UNKNOWN'), 'UNKNOWN');
  });
});
