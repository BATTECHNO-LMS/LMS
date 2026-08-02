'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveOrganizationIdFilter,
  assertOrganizationAccess,
  requireOrganizationType,
} = require('../src/utils/organizationScope');

describe('organizationScope', () => {
  it('allows global admin any org filter', () => {
    const id = resolveOrganizationIdFilter({ isGlobal: true }, '11111111-1111-1111-1111-111111111111');
    assert.equal(id, '11111111-1111-1111-1111-111111111111');
  });

  it('forces non-global users to their organization', () => {
    const org = '22222222-2222-2222-2222-222222222222';
    assert.equal(resolveOrganizationIdFilter({ isGlobal: false, organizationId: org }, null), org);
  });

  it('rejects cross-organization access', () => {
    assert.throws(
      () =>
        assertOrganizationAccess(
          { isGlobal: false, organizationId: '22222222-2222-2222-2222-222222222222' },
          '33333333-3333-3333-3333-333333333333'
        ),
      (err) => err.statusCode === 403
    );
  });

  it('requires matching organization type for non-global users', () => {
    assert.throws(
      () => requireOrganizationType({ isGlobal: false, organizationType: 'UNIVERSITY' }, 'INSTITUTION'),
      (err) => err.statusCode === 403
    );
    assert.doesNotThrow(() =>
      requireOrganizationType({ isGlobal: false, organizationType: 'INSTITUTION' }, 'INSTITUTION')
    );
  });
});
