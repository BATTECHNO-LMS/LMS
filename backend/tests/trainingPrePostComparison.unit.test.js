'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  latestAttemptByEnrollment,
  buildPrePostComparisonItems,
} = require('../src/modules/trainingPrograms/trainingPrePostComparison');

describe('pre/post comparison batching helpers', () => {
  it('keeps the latest attempt per enrollment (not N queries)', () => {
    const map = latestAttemptByEnrollment([
      { enrollment_id: 'e1', attempt_no: 1, score: 40 },
      { enrollment_id: 'e1', attempt_no: 3, score: 70 },
      { enrollment_id: 'e1', attempt_no: 2, score: 55 },
      { enrollment_id: 'e2', attempt_no: 1, score: 90 },
    ]);
    assert.equal(map.get('e1').score, 70);
    assert.equal(map.get('e2').score, 90);
    assert.equal(map.size, 2);
  });

  it('computes scores, pass flags, and improvement like the previous per-enrollment loop', () => {
    const pre = { id: 'pre', pass_score: 60 };
    const post = { id: 'post', pass_score: 70 };
    const enrollments = [
      { id: 'e1', user_id: 'u1' },
      { id: 'e2', user_id: 'u2' },
      { id: 'e3', user_id: 'u3' },
    ];
    const usersById = new Map([
      ['u1', { full_name: 'أحمد' }],
      ['u2', { full_name: 'Sara' }],
    ]);
    const preByEnrollment = latestAttemptByEnrollment([
      { enrollment_id: 'e1', attempt_no: 1, score: 50 },
      { enrollment_id: 'e2', attempt_no: 1, score: 80 },
    ]);
    const postByEnrollment = latestAttemptByEnrollment([
      { enrollment_id: 'e1', attempt_no: 1, score: 75 },
    ]);
    const items = buildPrePostComparisonItems({
      enrollments,
      usersById,
      pre,
      post,
      preByEnrollment,
      postByEnrollment,
    });

    assert.equal(items.length, 3);
    assert.deepEqual(items[0], {
      enrollmentId: 'e1',
      userId: 'u1',
      traineeName: 'أحمد',
      preScore: 50,
      postScore: 75,
      difference: 25,
      improvementPct: 50,
      prePassed: false,
      postPassed: true,
    });
    assert.equal(items[1].traineeName, 'Sara');
    assert.equal(items[1].preScore, 80);
    assert.equal(items[1].postScore, null);
    assert.equal(items[1].difference, null);
    assert.equal(items[1].prePassed, true);
    assert.equal(items[1].postPassed, null);
    assert.equal(items[2].traineeName, '—');
    assert.equal(items[2].preScore, null);
    assert.equal(items[2].postScore, null);
  });

  it('scopes trainee-only rows when the caller already filtered enrollments', () => {
    const items = buildPrePostComparisonItems({
      enrollments: [{ id: 'mine', user_id: 'self' }],
      usersById: new Map([['self', { full_name: 'Me' }]]),
      pre: { pass_score: 50 },
      post: null,
      preByEnrollment: latestAttemptByEnrollment([{ enrollment_id: 'mine', attempt_no: 1, score: 88 }]),
      postByEnrollment: latestAttemptByEnrollment([]),
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].userId, 'self');
    assert.equal(items[0].preScore, 88);
    assert.equal(items[0].postScore, null);
  });
});
