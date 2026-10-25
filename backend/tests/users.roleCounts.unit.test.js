'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildCanonicalRoleCountMap } = require('../src/modules/users/users.roleCounts');

describe('buildCanonicalRoleCountMap', () => {
  it('counts distinct existing users per canonical role', () => {
    const counts = buildCanonicalRoleCountMap([
      { user_id: 'u1', code: 'student' },
      { user_id: 'u2', code: 'student' },
      { user_id: 'u2', code: 'student' },
      { user_id: 'u3', code: 'admin' },
      { user_id: 'u4', code: 'instructor' },
      { user_id: 'u5', code: 'reviewer' },
    ]);
    assert.equal(counts.student, 2);
    assert.equal(counts.admin, 1);
    assert.equal(counts.instructor, 1);
    assert.equal(counts.reviewer, 1);
    assert.equal(counts.super_admin, 0);
  });

  it('maps legacy role codes into canonical buckets without double-counting one user', () => {
    const counts = buildCanonicalRoleCountMap([
      { user_id: 'a1', code: 'university_admin' },
      { user_id: 'a1', code: 'academic_admin' },
      { user_id: 'a2', code: 'qa_officer' },
      { user_id: 'a3', code: 'admin' },
      { user_id: 'r1', code: 'university_reviewer' },
      { user_id: 'r2', code: 'reviewer' },
    ]);
    assert.equal(counts.admin, 3);
    assert.equal(counts.reviewer, 2);
  });

  it('ignores unknown / empty rows', () => {
    const counts = buildCanonicalRoleCountMap([
      { user_id: 'u1', code: 'not_a_role' },
      { user_id: '', code: 'student' },
      { user_id: null, code: 'student' },
    ]);
    assert.equal(counts.student, 0);
    assert.equal(counts.admin, 0);
  });
});
