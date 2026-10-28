'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  issueEmailVerificationOtp,
} = require('../src/modules/auth/emailVerification.service');
const { AUTH_ERROR_CODES, messageForCode } = require('../src/utils/authErrorCatalog');
const { mapPrismaError } = require('../src/middlewares/error.middleware');
const { assertActiveUniversitySpecialtyForUniversity } =
  require('../src/modules/universitySpecialties/universitySpecialties.service');

describe('registration email-delivery semantics', () => {
  it('issueEmailVerificationOtp returns deliveryFailed=true instead of throwing when send fails', async () => {
    let persisted = 0;
    const result = await issueEmailVerificationOtp(
      { id: '11111111-1111-4111-8111-111111111111', email: '21220019@htu.edu.jo', full_name: "HA'A" },
      {
        persistOtp: async () => {
          persisted += 1;
        },
        send: async () => {
          throw new Error('The associated domain with your API key is not verified.');
        },
      }
    );
    assert.equal(persisted, 1);
    assert.equal(result.email, '21220019@htu.edu.jo');
    assert.equal(result.deliveryFailed, true);
  });

  it('issueEmailVerificationOtp returns deliveryFailed=false when send succeeds', async () => {
    const result = await issueEmailVerificationOtp(
      { id: '11111111-1111-4111-8111-111111111111', email: 'ok@htu.edu.jo', full_name: 'OK' },
      {
        persistOtp: async () => {},
        send: async () => ({ id: 'msg_1' }),
      }
    );
    assert.equal(result.deliveryFailed, false);
  });

  it('maps Prisma email unique constraint to 409 EMAIL_ALREADY_EXISTS (not raw 500)', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: { target: ['email'] },
    });
    assert.ok(mapped);
    assert.equal(mapped.statusCode, 409);
    assert.equal(mapped.code, AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS);
  });

  it('exposes EMAIL_DELIVERY_FAILED catalog message for resend path', () => {
    assert.match(messageForCode(AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED), /رمز التحقق/);
  });
});

describe('university specialty mismatch is controlled 400', () => {
  it('assertActiveUniversitySpecialtyForUniversity throws UNIVERSITY_SPECIALTY_MISMATCH when row missing', async () => {
    const original = require('../src/modules/universitySpecialties/universitySpecialties.repository');
    const prev = original.findActiveByIdForUniversity;
    original.findActiveByIdForUniversity = async () => null;
    try {
      await assert.rejects(
        () =>
          assertActiveUniversitySpecialtyForUniversity(
            '22222222-2222-4222-8222-222222222222',
            '33333333-3333-4333-8333-333333333333'
          ),
        (err) =>
          err?.statusCode === 400 && err?.code === AUTH_ERROR_CODES.UNIVERSITY_SPECIALTY_MISMATCH
      );
    } finally {
      original.findActiveByIdForUniversity = prev;
    }
  });
});
