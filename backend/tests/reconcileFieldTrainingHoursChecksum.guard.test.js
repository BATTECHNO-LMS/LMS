'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertRecoveryAuthorization,
  assertProductionDatabaseUrl,
  APPROVED_HOST_FP,
  APPROVED_DB_FP,
} = require('../scripts/lib/reconcileChecksumGuards');

describe('reconcileChecksumGuards', () => {
  test('refuses when ALLOW_PRISMA_CHECKSUM_RECONCILE is missing', () => {
    assert.throws(
      () => assertRecoveryAuthorization({}),
      /ALLOW_PRISMA_CHECKSUM_RECONCILE=true/
    );
  });

  test('refuses when ALLOW is not exact true', () => {
    for (const bad of ['1', 'TRUE', 'true ', 'false']) {
      assert.throws(
        () =>
          assertRecoveryAuthorization({
            ALLOW_PRISMA_CHECKSUM_RECONCILE: bad,
            NEON_RECOVERY_BRANCH_REF: 'br-test',
          }),
        /ALLOW_PRISMA_CHECKSUM_RECONCILE=true/
      );
    }
  });

  test('allows recovery branch path when branch ref is set', () => {
    const result = assertRecoveryAuthorization({
      ALLOW_PRISMA_CHECKSUM_RECONCILE: 'true',
      NEON_RECOVERY_BRANCH_REF: 'br-abc-123',
    });
    assert.equal(result.mode, 'recovery_branch');
    assert.equal(result.recoveryRef, 'br-abc-123');
    assert.equal(result.ownerAcceptedNoRecovery, false);
  });

  test('refuses no-recovery path without explicit owner flag', () => {
    assert.throws(
      () =>
        assertRecoveryAuthorization({
          ALLOW_PRISMA_CHECKSUM_RECONCILE: 'true',
        }),
      /NEON_RECOVERY_BRANCH_REF or OWNER_ACCEPTS_NO_RECOVERY_POINT=true/
    );
  });

  test('refuses OWNER_ACCEPTS_NO_RECOVERY_POINT unless exact true', () => {
    for (const bad of ['1', 'TRUE', 'true ', 'false', 'yes']) {
      assert.throws(
        () =>
          assertRecoveryAuthorization({
            ALLOW_PRISMA_CHECKSUM_RECONCILE: 'true',
            OWNER_ACCEPTS_NO_RECOVERY_POINT: bad,
          }),
        /NEON_RECOVERY_BRANCH_REF or OWNER_ACCEPTS_NO_RECOVERY_POINT=true/
      );
    }
  });

  test('allows owner no-recovery path when both flags are exact true', () => {
    const result = assertRecoveryAuthorization({
      ALLOW_PRISMA_CHECKSUM_RECONCILE: 'true',
      OWNER_ACCEPTS_NO_RECOVERY_POINT: 'true',
    });
    assert.equal(result.mode, 'owner_no_recovery');
    assert.equal(result.recoveryRef, null);
    assert.equal(result.ownerAcceptedNoRecovery, true);
  });

  test('prefers recovery branch when both branch ref and owner flag are set', () => {
    const result = assertRecoveryAuthorization({
      ALLOW_PRISMA_CHECKSUM_RECONCILE: 'true',
      NEON_RECOVERY_BRANCH_REF: 'br-priority',
      OWNER_ACCEPTS_NO_RECOVERY_POINT: 'true',
    });
    assert.equal(result.mode, 'recovery_branch');
    assert.equal(result.recoveryRef, 'br-priority');
  });

  test('assertProductionDatabaseUrl rejects unexpected host fingerprint', () => {
    assert.throws(
      () => assertProductionDatabaseUrl('postgresql://u:p@127.0.0.1:5432/lms'),
      /unexpected host fingerprint/
    );
  });

  test('assertProductionDatabaseUrl accepts approved host and db fingerprints', () => {
    const approvedHost = 'ep-divine-dust-ajorp5w4-pooler.c-3.us-east-2.aws.neon.tech';
    const approvedDb = 'neondb';
    const result = assertProductionDatabaseUrl(
      `postgresql://user:pass@${approvedHost}:5432/${approvedDb}?sslmode=require`
    );
    assert.equal(result.hostFp, APPROVED_HOST_FP);
    assert.equal(result.dbFp, APPROVED_DB_FP);
  });
});
