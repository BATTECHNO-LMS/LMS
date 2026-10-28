'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { issuePasswordResetOtp, FORGOT_SUCCESS } = require('../src/modules/auth/passwordReset.service');

describe('password reset OTP email soft-fail', () => {
  it('returns deliveryFailed=true instead of throwing when send fails', async () => {
    let persisted = 0;
    const result = await issuePasswordResetOtp(
      { id: '11111111-1111-4111-8111-111111111111', email: 'student@htu.edu.jo', full_name: 'S' },
      {
        persistOtp: async () => {
          persisted += 1;
        },
        send: async () => {
          const err = new Error('Failed to send password reset email');
          err.category = 'sender_domain_unverified';
          throw err;
        },
      }
    );
    assert.equal(persisted, 1);
    assert.equal(result.deliveryFailed, true);
    assert.equal(result.email, 'student@htu.edu.jo');
  });

  it('keeps generic forgot-password success copy for anti-enumeration', () => {
    assert.match(FORGOT_SUCCESS, /إذا كان البريد/);
  });
});
