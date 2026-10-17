'use strict';

/**
 * MFA (TOTP + one-time recovery codes), pre-session challenges, step-up and admin reset.
 *
 * Lifecycle for an account that must / does use MFA:
 *   password OK → createChallenge(LOGIN | ENROLL) → [enroll: start → verify → acknowledge]
 *   → challenge COMPLETED → caller creates the auth session (authentication_level = MFA).
 * No auth session and no JWT exist before the challenge completes.
 *
 * Never logged / audited / returned after provisioning: the TOTP secret, otpauth URI, QR,
 * TOTP codes, recovery codes, challenge tokens, passwords.
 */

const { env } = require('../../../config/env');
const { ApiError, crossScopeForbidden } = require('../../../utils/apiError');
const { AUTH_ERROR_CODES, messageForCode, maskEmail } = require('../../../utils/authErrorCatalog');
const { comparePassword } = require('../../../utils/password');
const { recordSecurityEvent } = require('../../../shared/security/securityEvents');
const { getRequestContext } = require('../../../shared/requestContext');
const mfaCrypto = require('../../../shared/security/mfaCrypto');
const totp = require('./totp');
const { getMfaStore } = require('./mfa.store');
const mfaPolicy = require('./mfaPolicy');

const CHALLENGE_PURPOSES = Object.freeze({ LOGIN: 'LOGIN', ENROLL: 'ENROLL' });
const CHALLENGE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  LOCKED: 'LOCKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});
const MAX_LOCK_MS = 24 * 3_600_000;

function fail(status, code, details = null) {
  return new ApiError(status, messageForCode(code), details, code);
}

function cryptoUnavailable(err) {
  if (err instanceof mfaCrypto.MfaConfigurationError) return fail(503, AUTH_ERROR_CODES.MFA_UNAVAILABLE);
  return null;
}

/** Wrap crypto calls: configuration problems surface as 503, never as "plaintext fallback". */
function withCrypto(fn) {
  try {
    return fn();
  } catch (err) {
    throw cryptoUnavailable(err) || err;
  }
}

function event(eventType, fields) {
  return recordSecurityEvent({ eventType, ...fields });
}

function lockDurationMs(failures) {
  const threshold = env.MFA_USER_LOCK_THRESHOLD;
  if (failures < threshold || failures % threshold !== 0) return 0;
  const k = failures / threshold;
  return Math.min(env.MFA_USER_LOCK_MINUTES * 60_000 * 2 ** (k - 1), MAX_LOCK_MS);
}

function isLocked(method, now) {
  return Boolean(method?.locked_until) && new Date(method.locked_until).getTime() > new Date(now).getTime();
}

function assertNotLocked(method, now, { req, userId } = {}) {
  if (!isLocked(method, now)) return;
  event('MFA_RATE_LIMIT_TRIGGERED', {
    outcome: 'BLOCKED',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'user',
    entityId: userId,
    reason: 'USER_COOLDOWN_ACTIVE',
    dedupeKey: `cooldown|${userId}`,
    dedupeWindowMs: 5 * 60_000,
  });
  throw fail(429, AUTH_ERROR_CODES.MFA_TEMPORARILY_LOCKED);
}

// ── status ──────────────────────────────────────────────────────────────────

async function getMfaStatusForUser(userId) {
  const store = getMfaStore();
  const method = await store.findActiveMethod(userId);
  const remaining = method ? await store.countRemainingRecoveryCodes(userId) : 0;
  return {
    enabled: Boolean(method),
    type: method ? 'TOTP' : null,
    enabledAt: method?.enabled_at ?? null,
    lastUsedAt: method?.last_used_at ?? null,
    recoveryCodesRemaining: remaining,
  };
}

async function hasEnabledMfa(userId) {
  return Boolean(await getMfaStore().findActiveMethod(userId));
}

// ── challenges ──────────────────────────────────────────────────────────────

/**
 * Password verified, MFA pending. Supersedes any earlier open challenge of the user.
 * @returns {Promise<{ challengeToken: string, expiresIn: number, purpose: string }>}
 */
async function createChallenge({ userId, purpose, portalType, ipAddress, userAgent, req, now = new Date() }) {
  const store = getMfaStore();
  await store.cancelOpenChallenges(userId, { now });
  const token = mfaCrypto.generateChallengeToken();
  const ttlMs = env.MFA_CHALLENGE_TTL_MINUTES * 60_000;
  const row = await store.createChallenge({
    user_id: userId,
    token_hash: mfaCrypto.hashChallengeToken(token),
    purpose,
    status: CHALLENGE_STATUS.PENDING,
    portal_type: portalType || null,
    ip_address: ipAddress ? String(ipAddress).slice(0, 64) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 512) : null,
    attempts: 0,
    created_request_id: getRequestContext()?.requestId ? String(getRequestContext().requestId).slice(0, 128) : null,
    created_at: now,
    expires_at: new Date(now.getTime() + ttlMs),
  });
  await event('MFA_CHALLENGE_CREATED', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'auth_mfa_challenge',
    entityId: row.id,
    metadata: { purpose, portalType: portalType || undefined },
  });
  return { challengeToken: token, expiresIn: Math.round(ttlMs / 1000), purpose };
}

/** Token → open challenge of the expected purpose/status, or MFA_CHALLENGE_INVALID. */
async function loadOpenChallenge(token, purpose, statuses, now = new Date()) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  }
  const store = getMfaStore();
  const row = await store.findChallengeByTokenHash(mfaCrypto.hashChallengeToken(token));
  if (!row || row.purpose !== purpose || !statuses.includes(row.status)) {
    throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  }
  if (new Date(row.expires_at).getTime() <= new Date(now).getTime()) {
    await store.transitionChallenge(row.id, [CHALLENGE_STATUS.PENDING, CHALLENGE_STATUS.VERIFIED], {
      status: CHALLENGE_STATUS.EXPIRED,
      completed_at: now,
    });
    throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  }
  return row;
}

/**
 * Count a wrong code / password against the challenge and the user's factor.
 * @returns {Promise<{ challengeLocked: boolean, userLocked: boolean }>}
 */
async function registerFailure({ challenge, method, userId, req, kind, factor, purpose, now = new Date() }) {
  const store = getMfaStore();
  let challengeLocked = false;
  let userLocked = false;
  if (challenge) {
    const attempts = await store.incrementChallengeAttempts(challenge.id);
    if (attempts == null || attempts >= env.MFA_MAX_ATTEMPTS) {
      await store.transitionChallenge(challenge.id, [CHALLENGE_STATUS.PENDING, CHALLENGE_STATUS.VERIFIED], {
        status: CHALLENGE_STATUS.LOCKED,
        completed_at: now,
      });
      challengeLocked = true;
      await event('MFA_RATE_LIMIT_TRIGGERED', {
        outcome: 'BLOCKED',
        req,
        userId,
        subjectUserId: userId,
        entityType: 'auth_mfa_challenge',
        entityId: challenge.id,
        reason: 'CHALLENGE_ATTEMPTS_EXCEEDED',
        metadata: { maxAttempts: env.MFA_MAX_ATTEMPTS },
      });
    }
  }
  if (method) {
    const failures = await store.incrementMethodFailures(method.id, { now });
    const lockMs = lockDurationMs(failures);
    if (lockMs) {
      await store.lockMethod(method.id, { lockedUntil: new Date(now.getTime() + lockMs), now });
      userLocked = true;
      await event('MFA_RATE_LIMIT_TRIGGERED', {
        outcome: 'BLOCKED',
        req,
        userId,
        subjectUserId: userId,
        entityType: 'user',
        entityId: userId,
        reason: 'USER_COOLDOWN',
        metadata: { cooldownMinutes: Math.round(lockMs / 60_000) },
      });
    }
  }
  await event(kind === 'STEP_UP' ? 'MFA_STEP_UP_FAILED' : 'MFA_CHALLENGE_FAILED', {
    outcome: 'FAILED',
    req,
    userId,
    subjectUserId: userId,
    entityType: challenge ? 'auth_mfa_challenge' : 'user',
    entityId: challenge ? challenge.id : userId,
    reason: factor === 'PASSWORD' ? 'PASSWORD_INVALID' : 'CODE_INVALID',
    metadata: { purpose: purpose || kind, factor },
  });
  return { challengeLocked, userLocked };
}

function failureError({ challengeLocked, userLocked }) {
  if (userLocked) return fail(429, AUTH_ERROR_CODES.MFA_TEMPORARILY_LOCKED);
  if (challengeLocked) return fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  return fail(400, AUTH_ERROR_CODES.MFA_CODE_INVALID);
}

/** TOTP against the enabled factor, rejecting any already-used (or older) time step. */
async function verifyTotpForMethod(method, code, now) {
  const secret = withCrypto(() => mfaCrypto.decryptSecret(method.secret_encrypted, method.user_id));
  const result = await totp.verifyTotp({ secret, code, afterTimeStep: method.last_used_step, now });
  if (!result.valid) return false;
  return getMfaStore().recordTotpSuccess(method.id, { now, timeStep: result.timeStep });
}

async function consumeRecoveryCode(method, rawCode, now) {
  const normalized = mfaCrypto.normalizeRecoveryCode(rawCode);
  if (!normalized) return false;
  const hash = withCrypto(() => mfaCrypto.hashRecoveryCode(normalized));
  const store = getMfaStore();
  const ok = await store.consumeRecoveryCode(method.user_id, hash, { now });
  if (ok) await store.recordRecoverySuccess(method.id, { now });
  return ok;
}

/**
 * Complete a LOGIN challenge with a TOTP or a recovery code. Single use: the challenge is
 * claimed with a conditional update, so a replayed token fails even with a valid code.
 * @returns {Promise<{ userId: string, portalType: string|null, loginMethod: string, mfaVerifiedAt: Date }>}
 */
async function verifyLoginChallenge({ challengeToken, code, recoveryCode, req, now = new Date() }) {
  const store = getMfaStore();
  const challenge = await loadOpenChallenge(challengeToken, CHALLENGE_PURPOSES.LOGIN, [CHALLENGE_STATUS.PENDING], now);
  const userId = challenge.user_id;
  const method = await store.findActiveMethod(userId);
  if (!method) {
    await store.transitionChallenge(challenge.id, [CHALLENGE_STATUS.PENDING], {
      status: CHALLENGE_STATUS.CANCELLED,
      completed_at: now,
    });
    throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  }
  assertNotLocked(method, now, { req, userId });

  const factor = recoveryCode ? 'RECOVERY_CODE' : 'TOTP';
  const ok = recoveryCode ? await consumeRecoveryCode(method, recoveryCode, now) : await verifyTotpForMethod(method, code, now);
  if (!ok) {
    const outcome = await registerFailure({ challenge, method, userId, req, kind: 'LOGIN', factor, purpose: 'LOGIN', now });
    throw failureError(outcome);
  }

  const claimed = await store.transitionChallenge(challenge.id, [CHALLENGE_STATUS.PENDING], {
    status: CHALLENGE_STATUS.COMPLETED,
    verified_at: now,
    completed_at: now,
  });
  if (!claimed) throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);

  await event('MFA_CHALLENGE_SUCCESS', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'auth_mfa_challenge',
    entityId: challenge.id,
    metadata: { purpose: 'LOGIN', factor },
  });
  if (factor === 'RECOVERY_CODE') {
    const remaining = await store.countRemainingRecoveryCodes(userId);
    await event('MFA_RECOVERY_CODE_USED', {
      outcome: 'SUCCESS',
      req,
      userId,
      subjectUserId: userId,
      entityType: 'user',
      entityId: userId,
      metadata: { recoveryCodesRemaining: remaining },
    });
  }
  return {
    userId,
    portalType: challenge.portal_type || null,
    loginMethod: factor === 'RECOVERY_CODE' ? 'PASSWORD_RECOVERY_CODE' : 'PASSWORD_TOTP',
    mfaVerifiedAt: now,
  };
}

async function cancelChallenge({ challengeToken, now = new Date() }) {
  if (typeof challengeToken !== 'string' || challengeToken.length < 20 || challengeToken.length > 200) return false;
  const store = getMfaStore();
  const row = await store.findChallengeByTokenHash(mfaCrypto.hashChallengeToken(challengeToken));
  if (!row) return false;
  return store.transitionChallenge(row.id, [CHALLENGE_STATUS.PENDING, CHALLENGE_STATUS.VERIFIED], {
    status: CHALLENGE_STATUS.CANCELLED,
    completed_at: now,
  });
}

// ── enrollment ──────────────────────────────────────────────────────────────

/** New pending TOTP factor; provisioning data is returned once and never persisted in plaintext. */
async function beginEnrollment({ userId, email, req, now = new Date() }) {
  const store = getMfaStore();
  const secret = totp.generateTotpSecret();
  const secretEncrypted = withCrypto(() => mfaCrypto.encryptSecret(secret, userId));
  await store.deletePendingMethods(userId);
  await store.createMethod({ userId, secretEncrypted, now });
  const accountLabel = maskEmail(String(email || '').toLowerCase()) || 'account';
  const otpauthUri = totp.buildOtpauthUri({ secret, accountLabel });
  const qrCodeDataUrl = await totp.qrDataUrl(otpauthUri);
  await event('MFA_ENROLLMENT_STARTED', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'user',
    entityId: userId,
    metadata: { type: 'TOTP' },
  });
  return {
    type: 'TOTP',
    issuer: env.MFA_ISSUER,
    accountLabel,
    manualEntryKey: totp.formatSecretForDisplay(secret),
    otpauthUri,
    qrCodeDataUrl,
    digits: totp.TOTP_DIGITS,
    period: totp.TOTP_PERIOD_SECONDS,
  };
}

/** Fresh recovery codes (plaintext returned once; only HMACs stored; previous unused codes revoked). */
async function issueRecoveryCodes(userId, now) {
  const codes = mfaCrypto.generateRecoveryCodes(env.MFA_RECOVERY_CODE_COUNT);
  const hashes = withCrypto(() => codes.map((c) => mfaCrypto.hashRecoveryCode(mfaCrypto.normalizeRecoveryCode(c))));
  const revokedPrevious = await getMfaStore().replaceRecoveryCodes(userId, hashes, { now });
  return { codes, revokedPrevious };
}

/**
 * Verify the first code against the pending factor → enable it → issue recovery codes.
 * @returns {Promise<{ ok: true, recoveryCodes: string[] } | { ok: false }>}
 */
async function finishEnrollment({ userId, code, req, now = new Date() }) {
  const store = getMfaStore();
  const pending = await store.findPendingMethod(userId);
  if (!pending) return { ok: false, missing: true };
  const secret = withCrypto(() => mfaCrypto.decryptSecret(pending.secret_encrypted, userId));
  const result = await totp.verifyTotp({ secret, code, now });
  if (!result.valid) return { ok: false, pending };
  const enabled = await store.enableMethod(pending.id, userId, { now, timeStep: result.timeStep });
  if (!enabled) return { ok: false, pending };
  const { codes } = await issueRecoveryCodes(userId, now);
  await event('MFA_ENABLED', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'user',
    entityId: userId,
    metadata: { type: 'TOTP', recoveryCodesIssued: codes.length },
  });
  return { ok: true, recoveryCodes: codes };
}

async function startChallengeEnrollment({ challengeToken, req, now = new Date() }) {
  const challenge = await loadOpenChallenge(challengeToken, CHALLENGE_PURPOSES.ENROLL, [CHALLENGE_STATUS.PENDING], now);
  const user = await getMfaStore().findUserBasics(challenge.user_id);
  if (!user || user.status !== 'active') throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  return beginEnrollment({ userId: user.id, email: user.email, req, now });
}

async function verifyChallengeEnrollment({ challengeToken, code, req, now = new Date() }) {
  const store = getMfaStore();
  const challenge = await loadOpenChallenge(challengeToken, CHALLENGE_PURPOSES.ENROLL, [CHALLENGE_STATUS.PENDING], now);
  const userId = challenge.user_id;
  const result = await finishEnrollment({ userId, code, req, now });
  if (!result.ok) {
    if (result.missing) throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
    const outcome = await registerFailure({ challenge, method: null, userId, req, kind: 'ENROLL', factor: 'TOTP', purpose: 'ENROLL', now });
    throw failureError(outcome);
  }
  const moved = await store.transitionChallenge(challenge.id, [CHALLENGE_STATUS.PENDING], {
    status: CHALLENGE_STATUS.VERIFIED,
    verified_at: now,
  });
  if (!moved) throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  return { recoveryCodes: result.recoveryCodes };
}

/** Recovery codes acknowledged → the challenge completes and the caller may issue the session. */
async function completeChallengeEnrollment({ challengeToken, req, now = new Date() }) {
  const store = getMfaStore();
  const challenge = await loadOpenChallenge(challengeToken, CHALLENGE_PURPOSES.ENROLL, [CHALLENGE_STATUS.VERIFIED], now);
  const claimed = await store.transitionChallenge(challenge.id, [CHALLENGE_STATUS.VERIFIED], {
    status: CHALLENGE_STATUS.COMPLETED,
    completed_at: now,
  });
  if (!claimed) throw fail(401, AUTH_ERROR_CODES.MFA_CHALLENGE_INVALID);
  await event('MFA_CHALLENGE_SUCCESS', {
    outcome: 'SUCCESS',
    req,
    userId: challenge.user_id,
    subjectUserId: challenge.user_id,
    entityType: 'auth_mfa_challenge',
    entityId: challenge.id,
    metadata: { purpose: 'ENROLL', factor: 'TOTP' },
  });
  return {
    userId: challenge.user_id,
    portalType: challenge.portal_type || null,
    loginMethod: 'PASSWORD_TOTP',
    mfaVerifiedAt: challenge.verified_at ? new Date(challenge.verified_at) : now,
  };
}

// ── authenticated self-service ─────────────────────────────────────────────

async function assertPassword(user, password) {
  if (typeof password !== 'string' || !password) return false;
  return comparePassword(password, user.password_hash);
}

async function startSelfEnrollment({ userId, password, req, now = new Date() }) {
  const store = getMfaStore();
  const user = await store.findUserBasics(userId);
  if (!user) throw fail(401, AUTH_ERROR_CODES.UNAUTHORIZED);
  if (await store.findActiveMethod(userId)) throw fail(409, AUTH_ERROR_CODES.MFA_ALREADY_ENABLED);
  if (!(await assertPassword(user, password))) {
    await event('MFA_STEP_UP_FAILED', {
      outcome: 'FAILED',
      req,
      userId,
      subjectUserId: userId,
      entityType: 'user',
      entityId: userId,
      reason: 'PASSWORD_INVALID',
      metadata: { purpose: 'SELF_ENROLL', factor: 'PASSWORD' },
    });
    throw fail(400, AUTH_ERROR_CODES.PASSWORD_CONFIRMATION_INVALID);
  }
  return beginEnrollment({ userId, email: user.email, req, now });
}

async function verifySelfEnrollment({ userId, sessionId, code, req, now = new Date() }) {
  const store = getMfaStore();
  if (await store.findActiveMethod(userId)) throw fail(409, AUTH_ERROR_CODES.MFA_ALREADY_ENABLED);
  const pending = await store.findPendingMethod(userId);
  if (!pending) throw fail(400, AUTH_ERROR_CODES.MFA_NOT_ENABLED);
  assertNotLocked(pending, now, { req, userId });
  const result = await finishEnrollment({ userId, code, req, now });
  if (!result.ok) {
    const outcome = await registerFailure({ challenge: null, method: pending, userId, req, kind: 'ENROLL', factor: 'TOTP', purpose: 'SELF_ENROLL', now });
    throw failureError(outcome);
  }
  const authSessions = require('../authSession.service');
  await authSessions.markSessionMfaVerified(sessionId, { now });
  return { recoveryCodes: result.recoveryCodes };
}

/** Password + current TOTP, both checked; failures count toward the factor cooldown. */
async function verifyPasswordAndTotp({ userId, password, code, req, purpose, now }) {
  const store = getMfaStore();
  const user = await store.findUserBasics(userId);
  const method = await store.findActiveMethod(userId);
  if (!user || !method) throw fail(400, AUTH_ERROR_CODES.MFA_NOT_ENABLED);
  assertNotLocked(method, now, { req, userId });
  if (!(await assertPassword(user, password))) {
    const outcome = await registerFailure({ challenge: null, method, userId, req, kind: 'STEP_UP', factor: 'PASSWORD', purpose, now });
    if (outcome.userLocked) throw fail(429, AUTH_ERROR_CODES.MFA_TEMPORARILY_LOCKED);
    throw fail(400, AUTH_ERROR_CODES.PASSWORD_CONFIRMATION_INVALID);
  }
  if (!(await verifyTotpForMethod(method, code, now))) {
    const outcome = await registerFailure({ challenge: null, method, userId, req, kind: 'STEP_UP', factor: 'TOTP', purpose, now });
    throw failureError(outcome);
  }
  return { user, method };
}

async function regenerateRecoveryCodes({ userId, sessionId, password, code, req, now = new Date() }) {
  await verifyPasswordAndTotp({ userId, password, code, req, purpose: 'REGENERATE_RECOVERY_CODES', now });
  const { codes, revokedPrevious } = await issueRecoveryCodes(userId, now);
  const authSessions = require('../authSession.service');
  await authSessions.markSessionMfaVerified(sessionId, { now });
  await event('MFA_RECOVERY_CODES_REGENERATED', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'user',
    entityId: userId,
    metadata: { recoveryCodesIssued: codes.length, previousCodesRevoked: revokedPrevious },
  });
  return { recoveryCodes: codes };
}

/** Optional-MFA users only; mandatory roles are refused before any credential is checked. */
async function disableOwnMfa({ authUser, password, code, req, now = new Date() }) {
  const userId = authUser.userId;
  if (mfaPolicy.isMfaRequiredForAuthContext(authUser)) {
    await event('MFA_STEP_UP_FAILED', {
      outcome: 'DENIED',
      req,
      userId,
      subjectUserId: userId,
      entityType: 'user',
      entityId: userId,
      reason: 'MFA_MANDATORY',
      metadata: { purpose: 'DISABLE_MFA' },
    });
    throw fail(403, AUTH_ERROR_CODES.MFA_DISABLE_FORBIDDEN);
  }
  await verifyPasswordAndTotp({ userId, password, code, req, purpose: 'DISABLE_MFA', now });
  const store = getMfaStore();
  await store.disableMethods(userId, { reason: 'USER_DISABLED', now });
  const revoked = await store.revokeRecoveryCodes(userId, { now });
  await event('MFA_DISABLED', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'user',
    entityId: userId,
    reason: 'USER_DISABLED',
    metadata: { recoveryCodesRevoked: revoked },
  });
  return { disabled: true };
}

/**
 * Step-up: current TOTP → fresh MFA assurance on the *current* session only
 * (no new token is issued). Freshness window: MFA_STEP_UP_MAX_AGE_MINUTES.
 */
async function stepUp({ userId, sessionId, code, req, now = new Date() }) {
  const store = getMfaStore();
  const method = await store.findActiveMethod(userId);
  if (!method) throw fail(400, AUTH_ERROR_CODES.MFA_NOT_ENABLED);
  assertNotLocked(method, now, { req, userId });
  if (!(await verifyTotpForMethod(method, code, now))) {
    const outcome = await registerFailure({ challenge: null, method, userId, req, kind: 'STEP_UP', factor: 'TOTP', purpose: 'STEP_UP', now });
    throw failureError(outcome);
  }
  const authSessions = require('../authSession.service');
  const marked = await authSessions.markSessionMfaVerified(sessionId, { now });
  if (!marked) throw fail(401, AUTH_ERROR_CODES.SESSION_ENDED);
  await event('MFA_STEP_UP_SUCCESS', {
    outcome: 'SUCCESS',
    req,
    userId,
    subjectUserId: userId,
    entityType: 'auth_session',
    entityId: sessionId,
    metadata: { factor: 'TOTP', validMinutes: env.MFA_STEP_UP_MAX_AGE_MINUTES },
  });
  return { stepUpExpiresAt: new Date(now.getTime() + mfaPolicy.stepUpMaxAgeMs()).toISOString() };
}

// ── administrative reset ───────────────────────────────────────────────────

async function denyAdminAction(req, requester, targetUserId, reason, { crossScope = false, eventType = 'MFA_ADMIN_RESET_DENIED' } = {}) {
  await event(eventType, {
    outcome: 'DENIED',
    req,
    userId: requester?.userId || null,
    subjectUserId: targetUserId,
    entityType: 'user',
    entityId: targetUserId,
    reason,
  });
  if (req) req.securityDenialRecorded = true;
  if (crossScope) throw crossScopeForbidden('Forbidden', { scopeType: 'user' });
  throw new ApiError(403, 'Forbidden', null, 'FORBIDDEN');
}

/**
 * Scope + privilege hierarchy for acting on another user's authentication factors:
 *   - requester must be a security admin in scope of the target (global / university / organization);
 *   - only global (super admin) may act on a global user or on any MFA-mandatory (privileged) user;
 *   - nobody resets their own factor through the admin path.
 */
async function assertAdminMayManageUserMfa(requester, targetUserId, req, { action = 'RESET' } = {}) {
  const auditScope = require('../../audit-logs/auditLogs.service');
  const scope = auditScope.resolveAuditScope(requester);
  if (!scope) return denyAdminAction(req, requester, targetUserId, 'NOT_SECURITY_ADMIN');
  if (String(requester.userId) === String(targetUserId) && action === 'RESET') {
    return denyAdminAction(req, requester, targetUserId, 'SELF_RESET_NOT_ALLOWED');
  }
  if (!(await auditScope.userInScope(targetUserId, scope))) {
    return denyAdminAction(req, requester, targetUserId, 'OUT_OF_SCOPE', { crossScope: true });
  }
  const store = getMfaStore();
  const target = await store.findUserBasics(targetUserId);
  if (!target) throw new ApiError(404, 'User not found');
  const subject = await store.loadPolicySubject(targetUserId);
  if (!requester.isGlobal && (subject.isGlobal || mfaPolicy.isMfaRequiredForUser(subject))) {
    return denyAdminAction(req, requester, targetUserId, 'TARGET_MORE_PRIVILEGED');
  }
  return { target, subject };
}

async function adminGetUserMfaStatus({ requester, targetUserId, req }) {
  const { subject } = await assertAdminMayManageUserMfa(requester, targetUserId, req, { action: 'VIEW' });
  const status = await getMfaStatusForUser(targetUserId);
  return { ...status, lastUsedAt: undefined, required: mfaPolicy.isMfaRequiredForUser(subject) };
}

/**
 * Disable the factor, revoke recovery codes and open challenges, end every session.
 * The user must log in with the password again and re-enroll if their role requires MFA.
 */
async function adminResetUserMfa({ requester, targetUserId, reason, req, now = new Date() }) {
  const { subject } = await assertAdminMayManageUserMfa(requester, targetUserId, req, { action: 'RESET' });
  const store = getMfaStore();
  const methodsDisabled = await store.disableMethods(targetUserId, { reason: 'ADMIN_RESET', now });
  const recoveryCodesRevoked = await store.revokeRecoveryCodes(targetUserId, { now });
  await store.cancelOpenChallenges(targetUserId, { now });
  const authSessions = require('../authSession.service');
  const sessionsEnded = await authSessions.endAllUserSessions(targetUserId, authSessions.SESSION_END_REASONS.MFA_RESET, {
    actorUserId: requester.userId,
    now,
  });
  const { invalidateAuthContextForUser } = require('../authContextCache');
  invalidateAuthContextForUser(targetUserId);
  await event('MFA_RESET_BY_ADMIN', {
    outcome: 'SUCCESS',
    req,
    userId: requester.userId,
    subjectUserId: targetUserId,
    entityType: 'user',
    entityId: targetUserId,
    reason: 'ADMIN_RESET',
    metadata: {
      justification: String(reason || '').slice(0, 200),
      hadMfa: methodsDisabled > 0,
      recoveryCodesRevoked,
      sessionsEnded,
      reEnrollmentRequired: mfaPolicy.isMfaRequiredForUser(subject),
    },
  });
  return { reset: true, sessionsEnded, reEnrollmentRequired: mfaPolicy.isMfaRequiredForUser(subject) };
}

module.exports = {
  CHALLENGE_PURPOSES,
  CHALLENGE_STATUS,
  lockDurationMs,
  getMfaStatusForUser,
  hasEnabledMfa,
  createChallenge,
  verifyLoginChallenge,
  cancelChallenge,
  startChallengeEnrollment,
  verifyChallengeEnrollment,
  completeChallengeEnrollment,
  startSelfEnrollment,
  verifySelfEnrollment,
  regenerateRecoveryCodes,
  disableOwnMfa,
  stepUp,
  assertAdminMayManageUserMfa,
  adminGetUserMfaStatus,
  adminResetUserMfa,
};
