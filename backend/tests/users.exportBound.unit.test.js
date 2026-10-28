'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  USERS_EXPORT_MAX_ROWS,
  findManyForExport,
} = require('../src/modules/users/users.repository');

describe('users export / role filter reliability', () => {
  it('exports are hard-capped', () => {
    assert.equal(USERS_EXPORT_MAX_ROWS, 5000);
    assert.equal(typeof findManyForExport, 'function');
  });
});
