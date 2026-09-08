'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  translateStudentActivityEvent,
  CATEGORY,
} = require('../src/modules/fieldTraining/fieldTraining.activityTranslate');

describe('translateStudentActivityEvent', () => {
  it('translates login events without exposing codes', () => {
    const result = translateStudentActivityEvent({
      action_type: 'USER_LOGIN_SUCCESS',
    });
    assert.equal(result.title, 'تسجيل الدخول');
    assert.match(result.description, /سجّل الطالب الدخول/);
    assert.equal(result.category, CATEGORY.ACCOUNT);
    assert.equal(result.title.includes('USER_LOGIN'), false);
  });

  it('includes task title when reviewing a submission', () => {
    const result = translateStudentActivityEvent({
      action_type: 'FIELD_TRAINING_SUBMISSION_REVIEWED',
      new_values: { taskTitle: 'المهمة الرابعة' },
    });
    assert.match(result.description, /المهمة الرابعة/);
    assert.equal(result.category, CATEGORY.TASKS);
  });

  it('falls back safely for unknown actions', () => {
    const result = translateStudentActivityEvent({
      action_type: 'SOME_INTERNAL_HTTP_TRACE',
    });
    assert.equal(result.title, 'نشاط على المنصة');
    assert.equal(result.description.includes('SOME_INTERNAL_HTTP_TRACE'), false);
  });
});
