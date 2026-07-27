'use strict';

/**
 * Unit tests for reviewer university assignment helpers (no DB).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmailDomain } = require('../src/utils/normalizeEmailDomain');
const { canonicalizeRoleCode, CANONICAL_ROLE_CODES } = require('../src/utils/roleCanon');

describe('reviewer role unification', () => {
  it('canonical roles include reviewer only (not academic_reviewer)', () => {
    assert.ok(CANONICAL_ROLE_CODES.includes('reviewer'));
    assert.equal(CANONICAL_ROLE_CODES.includes('academic_reviewer'), false);
    assert.equal(CANONICAL_ROLE_CODES.includes('university_reviewer'), false);
  });

  it('aliases legacy reviewer codes to reviewer', () => {
    assert.equal(canonicalizeRoleCode('academic_reviewer'), 'reviewer');
    assert.equal(canonicalizeRoleCode('university_reviewer'), 'reviewer');
  });

  it('normalizes email domains for matching', () => {
    assert.equal(normalizeEmailDomain('TTU.EDU.JO'), 'ttu.edu.jo');
    assert.equal(normalizeEmailDomain(' https://ttu.edu.jo/path '), 'ttu.edu.jo');
  });

  it('identifies free-mail domains that require manual assignment', () => {
    const free = new Set([
      'gmail.com',
      'googlemail.com',
      'outlook.com',
      'hotmail.com',
      'yahoo.com',
      'icloud.com',
      'live.com',
      'msn.com',
    ]);
    assert.ok(free.has(normalizeEmailDomain('gmail.com')));
    assert.equal(free.has(normalizeEmailDomain('ttu.edu.jo')), false);
  });
});
