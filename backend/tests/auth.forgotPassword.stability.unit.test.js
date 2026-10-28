'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  requestPasswordReset,
  issuePasswordResetOtp,
  FORGOT_SUCCESS,
} = require('../src/modules/auth/passwordReset.service');
const {
  classifyProviderError,
  RESEND_TIMEOUT_MS,
} = require('../src/shared/services/email.service');

describe('forgot-password stability', () => {
  for (const category of [
    'provider_auth_or_permission',
    'provider_timeout_or_network',
    'provider_server_error',
    'sender_domain_unverified',
  ]) {
    it(`issuePasswordResetOtp soft-fails on ${category}`, async () => {
      const result = await issuePasswordResetOtp(
        { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.com', full_name: 'A' },
        {
          persistOtp: async () => {},
          send: async () => {
            throw Object.assign(new Error('Failed to send password reset email'), { category });
          },
        }
      );
      assert.equal(result.deliveryFailed, true);
    });
  }

  it('keeps anti-enumeration success copy', () => {
    assert.match(FORGOT_SUCCESS, /إذا كان البريد/);
  });

  it('requestPasswordReset is exported', () => {
    assert.equal(typeof requestPasswordReset, 'function');
  });

  it('Resend HTTP timeout is finite (3–20s)', () => {
    assert.ok(RESEND_TIMEOUT_MS >= 3000 && RESEND_TIMEOUT_MS <= 20000);
  });

  it('classifies provider HTTP failures safely', () => {
    assert.equal(classifyProviderError(401, 'Unauthorized'), 'provider_auth_or_permission');
    assert.equal(classifyProviderError(500, 'boom'), 'provider_server_error');
    assert.equal(classifyProviderError(422, 'domain is not verified'), 'sender_domain_unverified');
    assert.equal(classifyProviderError(0, 'ETIMEDOUT'), 'provider_timeout_or_network');
  });
});
