'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isTrainerOnly } = require('../src/modules/trainingPrograms/trainerGuards');

describe('trainerGuards.isTrainerOnly', () => {
  it('is true for a trainer who is not an admin', () => {
    assert.equal(isTrainerOnly({ roles: ['trainer'], isGlobal: false }), true);
  });

  it('is false when trainer is also an organization admin', () => {
    assert.equal(isTrainerOnly({ roles: ['trainer', 'admin'], isGlobal: false }), false);
  });

  it('is false for system-wide admins even if trainer is listed', () => {
    assert.equal(isTrainerOnly({ roles: ['trainer'], isGlobal: true }), false);
  });

  it('is false for trainee/student-only callers', () => {
    assert.equal(isTrainerOnly({ roles: ['trainee'] }), false);
    assert.equal(isTrainerOnly({ roles: ['student'] }), false);
    assert.equal(isTrainerOnly(null), false);
  });
});
