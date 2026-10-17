'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { env } = require('../src/config/env');
const mfaCrypto = require('../src/shared/security/mfaCrypto');
const totp = require('../src/modules/auth/mfa/totp');
const mfaPolicy = require('../src/modules/auth/mfa/mfaPolicy');
const { lockDurationMs } = require('../src/modules/auth/mfa/mfa.service');

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function withEnv(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = env[k];
  Object.assign(env, patch);
  mfaCrypto.resetMfaKeyCacheForTests();
  try {
    return fn();
  } finally {
    Object.assign(env, saved);
    mfaCrypto.resetMfaKeyCacheForTests();
  }
}

describe('MFA encryption key validation (fail closed)', () => {
  it('accepts 32 random bytes as base64, base64url or hex', () => {
    const key = crypto.randomBytes(32);
    assert.ok(mfaCrypto.parseMasterKey(key.toString('base64')));
    assert.ok(mfaCrypto.parseMasterKey(key.toString('base64url')));
    assert.ok(mfaCrypto.parseMasterKey(key.toString('hex')));
  });

  it('rejects missing, short, long, non-encoded and constant keys', () => {
    for (const bad of ['', '   ', 'short', crypto.randomBytes(16).toString('base64'), crypto.randomBytes(48).toString('base64'), 'not base64 !!', Buffer.alloc(32).toString('base64'), 'a'.repeat(64)]) {
      assert.equal(mfaCrypto.parseMasterKey(bad), null, bad);
    }
  });

  it('validateMfaConfiguration reports a reason without echoing the key', () => {
    const bad = 'X'.repeat(30);
    const r = mfaCrypto.validateMfaConfiguration({ MFA_ENABLED: true, MFA_ENCRYPTION_KEY: bad });
    assert.equal(r.ok, false);
    assert.equal(r.reason.includes(bad), false);
    assert.equal(mfaCrypto.validateMfaConfiguration({ MFA_ENABLED: true, MFA_ENCRYPTION_KEY: '' }).ok, false);
    assert.equal(mfaCrypto.validateMfaConfiguration({ MFA_ENABLED: true, MFA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64') }).ok, true);
  });

  it('encrypt/decrypt/hash throw MfaConfigurationError when the key is missing — never plaintext', () => {
    withEnv({ MFA_ENCRYPTION_KEY: '' }, () => {
      assert.throws(() => mfaCrypto.encryptSecret('JBSWY3DPEHPK3PXP', USER_A), mfaCrypto.MfaConfigurationError);
      assert.throws(() => mfaCrypto.hashRecoveryCode('ABCDEFGHJKLM'), mfaCrypto.MfaConfigurationError);
    });
  });
});

describe('MFA secret encryption (AES-256-GCM)', () => {
  const saved = env.MFA_ENCRYPTION_KEY;
  before(() => {
    env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    mfaCrypto.resetMfaKeyCacheForTests();
  });
  after(() => {
    env.MFA_ENCRYPTION_KEY = saved;
    mfaCrypto.resetMfaKeyCacheForTests();
  });

  it('round-trips and never contains the plaintext; random IV per encryption', () => {
    const secret = totp.generateTotpSecret();
    const a = mfaCrypto.encryptSecret(secret, USER_A);
    const b = mfaCrypto.encryptSecret(secret, USER_A);
    assert.notEqual(a, b);
    assert.equal(a.includes(secret), false);
    assert.match(a, /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(mfaCrypto.decryptSecret(a, USER_A), secret);
  });

  it('is bound to the owning user (ciphertext moved to another user fails)', () => {
    const blob = mfaCrypto.encryptSecret(totp.generateTotpSecret(), USER_A);
    assert.throws(() => mfaCrypto.decryptSecret(blob, USER_B));
  });

  it('detects tampering and a rotated/wrong key', () => {
    const blob = mfaCrypto.encryptSecret(totp.generateTotpSecret(), USER_A);
    const parts = blob.split('.');
    const ct = Buffer.from(parts[3], 'base64url');
    ct[0] ^= 1;
    assert.throws(() => mfaCrypto.decryptSecret([parts[0], parts[1], parts[2], ct.toString('base64url')].join('.'), USER_A));
    withEnv({ MFA_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64') }, () => {
      assert.throws(() => mfaCrypto.decryptSecret(blob, USER_A));
    });
  });
});

describe('recovery codes and challenge tokens', () => {
  const saved = env.MFA_ENCRYPTION_KEY;
  before(() => {
    env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    mfaCrypto.resetMfaKeyCacheForTests();
  });
  after(() => {
    env.MFA_ENCRYPTION_KEY = saved;
    mfaCrypto.resetMfaKeyCacheForTests();
  });

  it('generates distinct XXXX-XXXX-XXXX codes from the unambiguous alphabet', () => {
    const codes = mfaCrypto.generateRecoveryCodes(10);
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const c of codes) assert.match(c, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('normalizes user input and hashes with a keyed HMAC (not the plain code)', () => {
    const [code] = mfaCrypto.generateRecoveryCodes(1);
    const n = mfaCrypto.normalizeRecoveryCode(` ${code.toLowerCase().replace(/-/g, ' ')} `);
    assert.equal(n, code.replace(/-/g, ''));
    const h = mfaCrypto.hashRecoveryCode(n);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.notEqual(h, crypto.createHash('sha256').update(n).digest('hex'), 'keyed, not a bare hash');
    assert.equal(mfaCrypto.normalizeRecoveryCode('O0I1-AAAA-BBBB'), null);
    assert.equal(mfaCrypto.normalizeRecoveryCode('123456'), null);
  });

  it('challenge tokens are 256-bit and stored as a SHA-256 hash only', () => {
    const t = mfaCrypto.generateChallengeToken();
    assert.ok(Buffer.from(t, 'base64url').length === 32);
    assert.equal(mfaCrypto.hashChallengeToken(t), crypto.createHash('sha256').update(t).digest('hex'));
  });
});

describe('TOTP (RFC 6238: SHA-1, 6 digits, 30 s, ±1 step)', () => {
  const secret = totp.generateTotpSecret();
  const now = new Date('2026-10-15T10:00:15.000Z');

  it('accepts the current code and ±1 step; rejects ±2 steps', async () => {
    for (const offsetSteps of [-1, 0, 1]) {
      const code = await totp.generateTotpCode(secret, new Date(now.getTime() + offsetSteps * 30_000));
      assert.equal((await totp.verifyTotp({ secret, code, now })).valid, true, `offset ${offsetSteps}`);
    }
    for (const offsetSteps of [-3, -2, 2, 3]) {
      const code = await totp.generateTotpCode(secret, new Date(now.getTime() + offsetSteps * 30_000));
      assert.equal((await totp.verifyTotp({ secret, code, now })).valid, false, `offset ${offsetSteps}`);
    }
  });

  it('replay protection: the same (or an older) time step is rejected once used', async () => {
    const code = await totp.generateTotpCode(secret, now);
    const first = await totp.verifyTotp({ secret, code, now });
    assert.equal(first.valid, true);
    assert.equal((await totp.verifyTotp({ secret, code, now, afterTimeStep: first.timeStep })).valid, false);
    const prev = await totp.generateTotpCode(secret, new Date(now.getTime() - 30_000));
    assert.equal((await totp.verifyTotp({ secret, code: prev, now, afterTimeStep: first.timeStep })).valid, false);
    const next = await totp.generateTotpCode(secret, new Date(now.getTime() + 30_000));
    assert.equal((await totp.verifyTotp({ secret, code: next, now, afterTimeStep: first.timeStep })).valid, true);
  });

  it('normalizes pasted codes and rejects malformed input', () => {
    assert.equal(totp.normalizeTotpCode(' 123 456 '), '123456');
    assert.equal(totp.normalizeTotpCode('123-456'), '123456');
    for (const bad of ['12345', '1234567', 'abcdef', '', null, undefined, {}]) assert.equal(totp.normalizeTotpCode(bad), null);
  });

  it('otpauth URI uses the issuer and standard parameters; QR is an in-memory data URL', async () => {
    const uri = totp.buildOtpauthUri({ secret, accountLabel: 'a***@example.edu' });
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /issuer=/);
    assert.match(uri, /secret=[A-Z2-7]+/);
    // Authenticator defaults (SHA-1 / 6 digits / 30 s) are implied; no non-standard overrides.
    assert.doesNotMatch(uri, /digits=(?!6\b)|period=(?!30\b)|algorithm=(?!SHA1\b)/i);
    const qr = await totp.qrDataUrl(uri);
    assert.match(qr, /^data:image\/png;base64,/);
  });
});

describe('MFA policy (centralized)', () => {
  it('super_admin and admin (platform or organization assignment) require MFA; others are optional', () => {
    assert.equal(mfaPolicy.isMfaRequiredForUser({ roles: ['super_admin'], isGlobal: true }), true);
    assert.equal(mfaPolicy.isMfaRequiredForUser({ roles: ['admin'] }), true);
    assert.equal(mfaPolicy.isMfaRequiredForUser({ roles: ['trainer'], assignmentRoleCodes: ['admin'] }), true);
    for (const role of ['student', 'trainee', 'trainer', 'instructor', 'reviewer']) {
      assert.equal(mfaPolicy.isMfaRequiredForUser({ roles: [role] }), false, role);
    }
  });

  it('auth-context form reads assignment rows and the active organization role', () => {
    assert.equal(mfaPolicy.isMfaRequiredForAuthContext({ roles: ['trainer'], _assignmentRows: [{ role_code: 'admin' }] }), true);
    assert.equal(mfaPolicy.isMfaRequiredForAuthContext({ roles: ['trainer'], organizationAssignment: { roleCode: 'admin' } }), true);
    assert.equal(mfaPolicy.isMfaRequiredForAuthContext({ roles: ['student'] }), false);
  });

  it('more roles can be made mandatory by configuration', () => {
    const saved = env.MFA_REQUIRED_ROLE_CODES;
    env.MFA_REQUIRED_ROLE_CODES = ['super_admin', 'admin', 'reviewer'];
    try {
      assert.equal(mfaPolicy.isMfaRequiredForUser({ roles: ['reviewer'] }), true);
    } finally {
      env.MFA_REQUIRED_ROLE_CODES = saved;
    }
  });

  it('step-up freshness window is server-side and bounded', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    const max = env.MFA_STEP_UP_MAX_AGE_MINUTES;
    assert.ok(max >= 5 && max <= 10, 'centralized window between 5 and 10 minutes by default');
    assert.equal(mfaPolicy.isStepUpFresh({ mfa_verified_at: new Date(now - 60_000) }, now), true);
    assert.equal(mfaPolicy.isStepUpFresh({ mfa_verified_at: new Date(now - max * 60_000) }, now), false);
    assert.equal(mfaPolicy.isStepUpFresh({ mfa_verified_at: null }, now), false);
    assert.equal(mfaPolicy.isStepUpFresh(null, now), false);
  });

  it('per-user cooldown escalates every threshold failures, capped at 24h', () => {
    const t = env.MFA_USER_LOCK_THRESHOLD;
    assert.equal(lockDurationMs(t - 1), 0);
    assert.equal(lockDurationMs(t), env.MFA_USER_LOCK_MINUTES * 60_000);
    assert.equal(lockDurationMs(t + 1), 0);
    assert.equal(lockDurationMs(2 * t), 2 * env.MFA_USER_LOCK_MINUTES * 60_000);
    assert.equal(lockDurationMs(50 * t), 24 * 3_600_000);
  });
});
