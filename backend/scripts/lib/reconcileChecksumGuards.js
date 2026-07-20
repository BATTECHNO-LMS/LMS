'use strict';

const crypto = require('crypto');

const APPROVED_HOST_FP = '82eea2790f';
const APPROVED_DB_FP = '693fe5919f';

function fingerprintHostname(hostname) {
  return crypto.createHash('sha256').update(hostname).digest('hex').slice(0, 10);
}

function fingerprintDatabase(databaseName) {
  return crypto.createHash('sha256').update(databaseName).digest('hex').slice(0, 10);
}

/**
 * Recovery authorization: default requires NEON_RECOVERY_BRANCH_REF.
 * Owner no-backup path requires OWNER_ACCEPTS_NO_RECOVERY_POINT=true exactly.
 */
function assertRecoveryAuthorization(env = process.env) {
  const allow = env.ALLOW_PRISMA_CHECKSUM_RECONCILE === 'true';
  if (!allow) {
    throw new Error(
      'Refusing: set ALLOW_PRISMA_CHECKSUM_RECONCILE=true after recovery point is confirmed or owner accepts no recovery point'
    );
  }

  const branchRef = (env.NEON_RECOVERY_BRANCH_REF || '').trim();
  const ownerNoRecovery = env.OWNER_ACCEPTS_NO_RECOVERY_POINT === 'true';

  if (branchRef) {
    return { mode: 'recovery_branch', recoveryRef: branchRef, ownerAcceptedNoRecovery: false };
  }

  if (ownerNoRecovery) {
    console.warn(
      'WARNING: Owner explicitly accepted proceeding without a Neon recovery branch, snapshot, or PITR reference.'
    );
    return { mode: 'owner_no_recovery', recoveryRef: null, ownerAcceptedNoRecovery: true };
  }

  throw new Error(
    'Refusing: set NEON_RECOVERY_BRANCH_REF or OWNER_ACCEPTS_NO_RECOVERY_POINT=true (exact value) after explicit owner approval'
  );
}

function assertProductionDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('Refusing: DATABASE_URL is missing');
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing: DATABASE_URL is invalid');
  }

  const hostFp = fingerprintHostname(parsed.hostname);
  if (hostFp !== APPROVED_HOST_FP) {
    throw new Error(`Refusing: unexpected host fingerprint ${hostFp}`);
  }

  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0] || '';
  const dbFp = fingerprintDatabase(dbName);
  if (dbFp !== APPROVED_DB_FP) {
    throw new Error(`Refusing: unexpected database fingerprint ${dbFp}`);
  }

  return { hostFp, dbFp };
}

module.exports = {
  APPROVED_HOST_FP,
  APPROVED_DB_FP,
  assertRecoveryAuthorization,
  assertProductionDatabaseUrl,
  fingerprintHostname,
  fingerprintDatabase,
};
