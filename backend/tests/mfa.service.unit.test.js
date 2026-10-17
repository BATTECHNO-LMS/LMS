'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { env } = require('../src/config/env');
const mfaCrypto = require('../src/shared/security/mfaCrypto');
const totp = require('../src/modules/auth/mfa/totp');
const mfa = require('../src/modules/auth/mfa/mfa.service');
const { setMfaStoreForTests, resetMfaStoreForTests } = require('../src/modules/auth/mfa/mfa.store');
const authSessions = require('../src/modules/auth/authSession.service');
const auditLogsService = require('../src/modules/audit-logs/auditLogs.service');
const { resetSecurityEventDedupeForTests } = require('../src/shared/security/securityEvents');
const { hashPassword } = require('../src/utils/password');
const { installAuditCapture } = require('./helpers/auditCapture');
const { makeFakeMfaStore, makeFakeSessionStore } = require('./helpers/fakeMfaStore');

const ADMIN = '11111111-1111-4111-8111-111111111111';
const STUDENT = '22222222-2222-4222-8222-222222222222';
const SUPER = '33333333-3333-4333-8333-333333333333';
const ADMIN_B = '44444444-4444-4444-8444-444444444444';
const STUDENT_B = '55555555-5555-4555-8555-555555555555';
const ADMIN_A2 = '66666666-6666-4666-8666-666666666666';
const UNI_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNI_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PASSWORD = 'Corr3ct-Horse-Battery!';
const T0 = new Date('2026-10-15T10:00:05.000Z');
const step = (n) => new Date(T0.getTime() + n * 30_000);

const TENANT = { [ADMIN]: UNI_A, [ADMIN_A2]: UNI_A, [STUDENT]: UNI_A, [ADMIN_B]: UNI_B, [STUDENT_B]: UNI_B, [SUPER]: null };

const requesters = {
  super: { userId: SUPER, isGlobal: true, roles: ['super_admin'], scope: { type: 'global' } },
  adminA: { userId: ADMIN, isGlobal: false, roles: ['admin'], universityId: UNI_A, scope: { type: 'university', universityId: UNI_A } },
  adminB: { userId: ADMIN_B, isGlobal: false, roles: ['admin'], universityId: UNI_B, scope: { type: 'university', universityId: UNI_B } },
};

describe('MFA service — challenge lifecycle, factors, step-up, admin reset', () => {
  let audit;
  let store;
  let sessions;
  let passwordHash;
  const savedEnv = {};
  const savedUserInScope = auditLogsService.userInScope;

  before(async () => {
    for (const k of ['MFA_ENABLED', 'MFA_ENCRYPTION_KEY']) savedEnv[k] = env[k];
    env.MFA_ENABLED = true;
    env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    mfaCrypto.resetMfaKeyCacheForTests();
    audit = installAuditCapture();
    passwordHash = await hashPassword(PASSWORD);
    auditLogsService.userInScope = async (userId, scope) => {
      if (!scope) return false;
      if (scope.type === 'global') return true;
      return Boolean(TENANT[userId]) && TENANT[userId] === scope.universityId;
    };
  });

  after(() => {
    Object.assign(env, savedEnv);
    mfaCrypto.resetMfaKeyCacheForTests();
    resetMfaStoreForTests();
    authSessions.resetAuthSessionStoreForTests();
    auditLogsService.userInScope = savedUserInScope;
    audit.restore();
  });

  beforeEach(() => {
    const user = (id, extra) => ({ id, email: `${id.slice(0, 4)}@uni.edu`, status: 'active', password_hash: passwordHash, ...extra });
    store = makeFakeMfaStore({
      users: {
        [ADMIN]: user(ADMIN, { roles: ['admin'] }),
        [ADMIN_B]: user(ADMIN_B, { roles: ['admin'] }),
        [ADMIN_A2]: user(ADMIN_A2, { roles: ['trainer'], assignmentRoleCodes: ['admin'] }),
        [STUDENT]: user(STUDENT, { roles: ['student'] }),
        [STUDENT_B]: user(STUDENT_B, { roles: ['student'] }),
        [SUPER]: user(SUPER, { roles: ['super_admin'], isGlobal: true }),
      },
    });
    sessions = makeFakeSessionStore();
    setMfaStoreForTests(store);
    authSessions.setAuthSessionStoreForTests(sessions);
    resetSecurityEventDedupeForTests();
    audit.clear();
  });

  async function enroll(userId, at = step(0)) {
    const ch = await mfa.createChallenge({ userId, purpose: 'ENROLL', now: at });
    const setup = await mfa.startChallengeEnrollment({ challengeToken: ch.challengeToken, now: at });
    const secret = setup.manualEntryKey.replace(/\s/g, '');
    const code = await totp.generateTotpCode(secret, at);
    const { recoveryCodes } = await mfa.verifyChallengeEnrollment({ challengeToken: ch.challengeToken, code, now: at });
    await mfa.completeChallengeEnrollment({ challengeToken: ch.challengeToken, now: at });
    return { secret, recoveryCodes, setup };
  }

  async function loginChallenge(userId, at) {
    return mfa.createChallenge({ userId, purpose: 'LOGIN', portalType: 'UNIVERSITY', now: at });
  }

  async function rejects(promise, code) {
    await assert.rejects(promise, (err) => {
      assert.equal(err.code, code);
      return true;
    });
  }

  // ── enrollment ──
  it('enrollment: QR + manual key once, secret encrypted at rest, 10 hashed recovery codes', async () => {
    const { secret, recoveryCodes, setup } = await enroll(ADMIN);
    assert.match(setup.qrCodeDataUrl, /^data:image\/png;base64,/);
    assert.match(setup.otpauthUri, /^otpauth:\/\/totp\//);
    assert.equal(recoveryCodes.length, env.MFA_RECOVERY_CODE_COUNT);
    const method = await store.findActiveMethod(ADMIN);
    assert.ok(method.enabled_at);
    assert.equal(method.secret_encrypted.includes(secret), false);
    assert.equal(mfaCrypto.decryptSecret(method.secret_encrypted, ADMIN), secret);
    const stored = store.codes.filter((c) => c.user_id === ADMIN);
    assert.equal(stored.length, recoveryCodes.length);
    for (const c of recoveryCodes) {
      assert.equal(stored.some((s) => s.code_hash.includes(c.replace(/-/g, ''))), false, 'no plaintext at rest');
    }
    assert.equal(audit.byAction('MFA_ENROLLMENT_STARTED').length, 1);
    assert.equal(audit.byAction('MFA_ENABLED').length, 1);
  });

  it('enrollment cannot complete before the code is verified, nor be completed twice', async () => {
    const ch = await mfa.createChallenge({ userId: ADMIN, purpose: 'ENROLL', now: step(0) });
    await mfa.startChallengeEnrollment({ challengeToken: ch.challengeToken, now: step(0) });
    await rejects(mfa.completeChallengeEnrollment({ challengeToken: ch.challengeToken, now: step(0) }), 'MFA_CHALLENGE_INVALID');
    await rejects(mfa.verifyChallengeEnrollment({ challengeToken: ch.challengeToken, code: '000000', now: step(0) }), 'MFA_CODE_INVALID');
    assert.equal(await store.findActiveMethod(ADMIN), null);
  });

  it('an ENROLL challenge cannot be used as a LOGIN challenge (purpose bound)', async () => {
    const ch = await mfa.createChallenge({ userId: ADMIN, purpose: 'ENROLL', now: step(0) });
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: '123456', now: step(0) }), 'MFA_CHALLENGE_INVALID');
  });

  // ── login challenge ──
  it('login challenge: correct TOTP completes once; the token cannot be replayed', async () => {
    const { secret } = await enroll(ADMIN);
    const ch = await loginChallenge(ADMIN, step(2));
    assert.equal(ch.expiresIn, env.MFA_CHALLENGE_TTL_MINUTES * 60);
    const code = await totp.generateTotpCode(secret, step(2));
    const done = await mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code, now: step(2) });
    assert.equal(done.userId, ADMIN);
    assert.equal(done.loginMethod, 'PASSWORD_TOTP');
    assert.equal(done.portalType, 'UNIVERSITY');
    const next = await totp.generateTotpCode(secret, step(3));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: next, now: step(3) }), 'MFA_CHALLENGE_INVALID');
    assert.equal(audit.byAction('MFA_CHALLENGE_SUCCESS').length, 2, 'enrollment completion + login');
  });

  it('a TOTP code already used cannot be reused on a new challenge (replay)', async () => {
    const { secret } = await enroll(ADMIN);
    const code = await totp.generateTotpCode(secret, step(2));
    const c1 = await loginChallenge(ADMIN, step(2));
    await mfa.verifyLoginChallenge({ challengeToken: c1.challengeToken, code, now: step(2) });
    const c2 = await loginChallenge(ADMIN, step(2));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: c2.challengeToken, code, now: step(2) }), 'MFA_CODE_INVALID');
  });

  it('expired challenge is rejected even with a valid code', async () => {
    const { secret } = await enroll(ADMIN);
    const ch = await loginChallenge(ADMIN, step(2));
    const later = new Date(step(2).getTime() + env.MFA_CHALLENGE_TTL_MINUTES * 60_000 + 1000);
    const code = await totp.generateTotpCode(secret, later);
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code, now: later }), 'MFA_CHALLENGE_INVALID');
  });

  it('a new challenge supersedes the previous one', async () => {
    const { secret } = await enroll(ADMIN);
    const old = await loginChallenge(ADMIN, step(2));
    await loginChallenge(ADMIN, step(2));
    const code = await totp.generateTotpCode(secret, step(2));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: old.challengeToken, code, now: step(2) }), 'MFA_CHALLENGE_INVALID');
  });

  it('cross-user: a challenge only accepts its own user\'s factor', async () => {
    await enroll(ADMIN, step(0));
    const other = await enroll(ADMIN_B, step(0));
    const ch = await loginChallenge(ADMIN, step(2));
    const codeOfB = await totp.generateTotpCode(other.secret, step(2));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: codeOfB, now: step(2) }), 'MFA_CODE_INVALID');
    const recoveryOfB = other.recoveryCodes[0];
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, recoveryCode: recoveryOfB, now: step(2) }), 'MFA_CODE_INVALID');
  });

  it('unknown / malformed challenge tokens are rejected uniformly', async () => {
    await rejects(mfa.verifyLoginChallenge({ challengeToken: 'x', code: '123456', now: step(0) }), 'MFA_CHALLENGE_INVALID');
    await rejects(mfa.verifyLoginChallenge({ challengeToken: mfaCrypto.generateChallengeToken(), code: '123456', now: step(0) }), 'MFA_CHALLENGE_INVALID');
  });

  // ── brute force ──
  it(`challenge locks after MFA_MAX_ATTEMPTS wrong codes; events recorded without the codes`, async () => {
    const { secret } = await enroll(ADMIN);
    audit.clear();
    const ch = await loginChallenge(ADMIN, step(2));
    for (let i = 1; i < env.MFA_MAX_ATTEMPTS; i += 1) {
      await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: '000000', now: step(2) }), 'MFA_CODE_INVALID');
    }
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: '000000', now: step(2) }), 'MFA_CHALLENGE_INVALID');
    const good = await totp.generateTotpCode(secret, step(2));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: good, now: step(2) }), 'MFA_CHALLENGE_INVALID');
    assert.equal(audit.byAction('MFA_CHALLENGE_FAILED').length, env.MFA_MAX_ATTEMPTS);
    assert.equal(audit.byAction('MFA_RATE_LIMIT_TRIGGERED').length, 1);
    assert.equal(JSON.stringify(audit.rows).includes('000000'), false);
  });

  it('per-user cooldown after MFA_USER_LOCK_THRESHOLD failures across challenges → 429', async () => {
    const { secret } = await enroll(ADMIN);
    let failures = 0;
    while (failures < env.MFA_USER_LOCK_THRESHOLD) {
      const ch = await loginChallenge(ADMIN, step(2));
      for (let i = 0; i < env.MFA_MAX_ATTEMPTS - 1 && failures < env.MFA_USER_LOCK_THRESHOLD; i += 1) {
        await mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: '000000', now: step(2) }).catch(() => {});
        failures += 1;
      }
    }
    const method = await store.findActiveMethod(ADMIN);
    assert.ok(method.locked_until > step(2));
    const ch = await loginChallenge(ADMIN, step(3));
    const good = await totp.generateTotpCode(secret, step(3));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, code: good, now: step(3) }), 'MFA_TEMPORARILY_LOCKED');
  });

  // ── recovery codes ──
  it('recovery code logs in once; reuse is blocked; event recorded without the code', async () => {
    const { recoveryCodes } = await enroll(ADMIN);
    const code = recoveryCodes[3];
    const c1 = await loginChallenge(ADMIN, step(2));
    const done = await mfa.verifyLoginChallenge({ challengeToken: c1.challengeToken, recoveryCode: code.toLowerCase(), now: step(2) });
    assert.equal(done.loginMethod, 'PASSWORD_RECOVERY_CODE');
    const c2 = await loginChallenge(ADMIN, step(3));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: c2.challengeToken, recoveryCode: code, now: step(3) }), 'MFA_CODE_INVALID');
    assert.equal(audit.byAction('MFA_RECOVERY_CODE_USED').length, 1);
    assert.equal(await store.countRemainingRecoveryCodes(ADMIN), recoveryCodes.length - 1);
    for (const c of recoveryCodes) assert.equal(JSON.stringify(audit.rows).includes(c), false);
  });

  it('regeneration requires password + TOTP and revokes every old code', async () => {
    const { secret, recoveryCodes } = await enroll(STUDENT);
    const s = await authSessions.createSession({ userId: STUDENT, portalType: 'UNIVERSITY', now: step(1) });
    const code = await totp.generateTotpCode(secret, step(2));
    await rejects(mfa.regenerateRecoveryCodes({ userId: STUDENT, sessionId: s.id, password: 'wrong', code, now: step(2) }), 'PASSWORD_CONFIRMATION_INVALID');
    await rejects(mfa.regenerateRecoveryCodes({ userId: STUDENT, sessionId: s.id, password: PASSWORD, code: '000000', now: step(2) }), 'MFA_CODE_INVALID');
    const { recoveryCodes: fresh } = await mfa.regenerateRecoveryCodes({ userId: STUDENT, sessionId: s.id, password: PASSWORD, code, now: step(2) });
    assert.equal(fresh.length, env.MFA_RECOVERY_CODE_COUNT);
    assert.equal(await store.countRemainingRecoveryCodes(STUDENT), fresh.length);
    const ch = await loginChallenge(STUDENT, step(3));
    await rejects(mfa.verifyLoginChallenge({ challengeToken: ch.challengeToken, recoveryCode: recoveryCodes[0], now: step(3) }), 'MFA_CODE_INVALID');
    assert.equal(audit.byAction('MFA_RECOVERY_CODES_REGENERATED').length, 1);
  });

  // ── disable ──
  it('self-disable is refused for mandatory roles and allowed (password + TOTP) for optional ones', async () => {
    await enroll(ADMIN);
    await rejects(
      mfa.disableOwnMfa({ authUser: { userId: ADMIN, roles: ['admin'] }, password: PASSWORD, code: '123456', now: step(2) }),
      'MFA_DISABLE_FORBIDDEN'
    );
    const { secret } = await enroll(STUDENT);
    const code = await totp.generateTotpCode(secret, step(2));
    await mfa.disableOwnMfa({ authUser: { userId: STUDENT, roles: ['student'] }, password: PASSWORD, code, now: step(2) });
    assert.equal(await store.findActiveMethod(STUDENT), null);
    assert.equal(await store.countRemainingRecoveryCodes(STUDENT), 0);
    assert.equal(audit.byAction('MFA_DISABLED').length, 1);
  });

  // ── step-up ──
  it('step-up marks only the current session fresh, rejects replay and wrong codes', async () => {
    const { secret } = await enroll(ADMIN);
    const s = await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY', authenticationLevel: 'MFA', mfaVerifiedAt: step(0), now: step(0) });
    const other = await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY', authenticationLevel: 'MFA', mfaVerifiedAt: step(0), now: step(0) });
    await rejects(mfa.stepUp({ userId: ADMIN, sessionId: s.id, code: '000000', now: step(40) }), 'MFA_CODE_INVALID');
    assert.equal(audit.byAction('MFA_STEP_UP_FAILED').length, 1);
    const code = await totp.generateTotpCode(secret, step(40));
    const res = await mfa.stepUp({ userId: ADMIN, sessionId: s.id, code, now: step(40) });
    assert.ok(res.stepUpExpiresAt);
    assert.equal(sessions.rows.get(s.id).mfa_verified_at.getTime(), step(40).getTime());
    assert.equal(sessions.rows.get(other.id).mfa_verified_at.getTime(), step(0).getTime());
    await rejects(mfa.stepUp({ userId: ADMIN, sessionId: s.id, code, now: step(40) }), 'MFA_CODE_INVALID');
    assert.equal(audit.byAction('MFA_STEP_UP_SUCCESS').length, 1);
  });

  // ── admin reset: hierarchy + scope ──
  it('super_admin resets an admin: factor + codes revoked, all sessions ended (MFA_RESET), event', async () => {
    await enroll(ADMIN);
    await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY', authenticationLevel: 'MFA', now: step(1) });
    await authSessions.createSession({ userId: ADMIN, portalType: 'UNIVERSITY', authenticationLevel: 'MFA', now: step(1) });
    const req = {};
    const res = await mfa.adminResetUserMfa({ requester: requesters.super, targetUserId: ADMIN, reason: 'Lost authenticator device', req, now: step(2) });
    assert.equal(res.sessionsEnded, 2);
    assert.equal(res.reEnrollmentRequired, true);
    assert.equal(await store.findActiveMethod(ADMIN), null);
    assert.equal(await store.countRemainingRecoveryCodes(ADMIN), 0);
    assert.ok([...sessions.rows.values()].every((r) => r.end_reason === 'MFA_RESET'));
    const ev = audit.byAction('MFA_RESET_BY_ADMIN');
    assert.equal(ev.length, 1);
    assert.equal(ev[0].user_id, SUPER);
    assert.equal(ev[0].subject_user_id, ADMIN);
  });

  const denied = [
    ['admin cannot reset a super_admin', 'adminA', SUPER, 'FORBIDDEN'],
    ['university admin cannot reset an institution admin of the same university (privileged target needs global)', 'adminA', ADMIN_A2, null],
    ['university admin cannot reset a user of another university', 'adminA', STUDENT_B, null],
    ['admin of university B cannot reset a student of university A', 'adminB', STUDENT, null],
    ['admins cannot reset their own factor through the admin path', 'adminA', ADMIN, 'FORBIDDEN'],
  ];
  for (const [title, who, target] of denied) {
    it(`denied: ${title} → 403 + MFA_ADMIN_RESET_DENIED`, async () => {
      await enroll(target);
      const req = {};
      await assert.rejects(
        mfa.adminResetUserMfa({ requester: requesters[who], targetUserId: target, reason: 'attempted reset reason', req, now: step(2) }),
        (err) => err.statusCode === 403
      );
      assert.equal(req.securityDenialRecorded, true);
      assert.equal(audit.byAction('MFA_ADMIN_RESET_DENIED').length, 1);
      assert.ok(await store.findActiveMethod(target), 'target factor untouched');
    });
  }

  it('university admin may reset a non-privileged user in their own university', async () => {
    await enroll(STUDENT);
    const res = await mfa.adminResetUserMfa({ requester: requesters.adminA, targetUserId: STUDENT, reason: 'Student lost phone', req: {}, now: step(2) });
    assert.equal(res.reset, true);
    assert.equal(res.reEnrollmentRequired, false);
  });

  it('no secret, otpauth URI, TOTP code, recovery code or challenge token reaches audit rows', async () => {
    const ch = await mfa.createChallenge({ userId: ADMIN, purpose: 'ENROLL', now: step(0) });
    const setup = await mfa.startChallengeEnrollment({ challengeToken: ch.challengeToken, now: step(0) });
    const secret = setup.manualEntryKey.replace(/\s/g, '');
    const code = await totp.generateTotpCode(secret, step(0));
    const { recoveryCodes } = await mfa.verifyChallengeEnrollment({ challengeToken: ch.challengeToken, code, now: step(0) });
    await mfa.completeChallengeEnrollment({ challengeToken: ch.challengeToken, now: step(0) });
    const json = JSON.stringify(audit.rows);
    for (const needle of [secret, setup.manualEntryKey, 'otpauth', code, ch.challengeToken, ...recoveryCodes]) {
      assert.equal(json.includes(needle), false, `leaked: ${needle.slice(0, 6)}…`);
    }
  });
});
