'use strict';

const mfaService = require('./mfa.service');
const authService = require('../auth.service');
const sessionManagement = require('../sessionManagement.service');
const { isMfaRequiredForAuthContext, stepUpExpiresAt, isStepUpFresh } = require('./mfaPolicy');
const { success } = require('../../../utils/apiResponse');
const { truncateUserAgent } = require('../../../shared/requestContext');
const { getSecurityClientIp } = require('../../../shared/security/clientIdentity');

/** Provisioning data, recovery codes and challenge results must never be cached. */
function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
}

function handler(fn) {
  return async (req, res, next) => {
    try {
      return await fn(req, res);
    } catch (e) {
      return next(e);
    }
  };
}

async function issueSessionAfterMfa(req, res, completion, message) {
  const data = await authService.completeMfaLogin({
    ...completion,
    ipAddress: getSecurityClientIp(req),
    userAgent: truncateUserAgent(req.headers['user-agent']),
  });
  return success(res, data, { message });
}

// ── pre-session (challenge token in body; no JWT exists yet) ───────────────

const verifyChallenge = handler(async (req, res) => {
  const { challengeToken, code, recoveryCode } = req.validated;
  const completion = await mfaService.verifyLoginChallenge({ challengeToken, code, recoveryCode, req });
  return issueSessionAfterMfa(req, res, completion, 'تم تسجيل الدخول بنجاح.');
});

const cancelChallenge = handler(async (req, res) => {
  await mfaService.cancelChallenge({ challengeToken: req.validated.challengeToken });
  return success(res, { cancelled: true }, { message: 'تم إلغاء عملية التحقق.' });
});

const enrollStart = handler(async (req, res) => {
  const data = await mfaService.startChallengeEnrollment({ challengeToken: req.validated.challengeToken, req });
  return success(res, data, { message: 'امسح رمز QR باستخدام تطبيق المصادقة.' });
});

const enrollVerify = handler(async (req, res) => {
  const { challengeToken, code } = req.validated;
  const data = await mfaService.verifyChallengeEnrollment({ challengeToken, code, req });
  return success(res, data, { message: 'تم تفعيل المصادقة الثنائية. احفظ رموز الاسترداد.' });
});

const enrollComplete = handler(async (req, res) => {
  const completion = await mfaService.completeChallengeEnrollment({ challengeToken: req.validated.challengeToken, req });
  return issueSessionAfterMfa(req, res, completion, 'تم إعداد المصادقة الثنائية وتسجيل الدخول بنجاح.');
});

// ── authenticated ──────────────────────────────────────────────────────────

const status = handler(async (req, res) => {
  const data = await mfaService.getMfaStatusForUser(req.user.userId);
  const session = req.authSession;
  return success(
    res,
    {
      ...data,
      required: isMfaRequiredForAuthContext(req.user),
      session: {
        authenticationLevel: session?.authentication_level || 'PASSWORD',
        stepUpFresh: isStepUpFresh(session),
        stepUpExpiresAt: stepUpExpiresAt(session),
      },
    },
    { message: 'OK' }
  );
});

const setupStart = handler(async (req, res) => {
  const data = await mfaService.startSelfEnrollment({ userId: req.user.userId, password: req.validated.password, req });
  return success(res, data, { message: 'امسح رمز QR باستخدام تطبيق المصادقة.' });
});

const setupVerify = handler(async (req, res) => {
  const data = await mfaService.verifySelfEnrollment({
    userId: req.user.userId,
    sessionId: req.authSession.id,
    code: req.validated.code,
    req,
  });
  return success(res, data, { message: 'تم تفعيل المصادقة الثنائية. احفظ رموز الاسترداد.' });
});

const regenerateRecoveryCodes = handler(async (req, res) => {
  const data = await mfaService.regenerateRecoveryCodes({
    userId: req.user.userId,
    sessionId: req.authSession.id,
    password: req.validated.password,
    code: req.validated.code,
    req,
  });
  return success(res, data, { message: 'تم إنشاء رموز استرداد جديدة وإلغاء الرموز السابقة.' });
});

const disable = handler(async (req, res) => {
  const data = await mfaService.disableOwnMfa({
    authUser: req.user,
    password: req.validated.password,
    code: req.validated.code,
    req,
  });
  return success(res, data, { message: 'تم إيقاف المصادقة الثنائية.' });
});

const stepUp = handler(async (req, res) => {
  const data = await mfaService.stepUp({
    userId: req.user.userId,
    sessionId: req.authSession.id,
    code: req.validated.code,
    req,
  });
  return success(res, data, { message: 'تم التحقق من هويتك.' });
});

const listSessions = handler(async (req, res) => {
  const data = await sessionManagement.listOwnSessions({
    userId: req.user.userId,
    currentSessionId: req.authSession.id,
  });
  return success(res, data, { message: 'OK' });
});

const endSession = handler(async (req, res) => {
  const data = await sessionManagement.endOwnSession({
    userId: req.user.userId,
    currentSessionId: req.authSession.id,
    sessionId: req.validated.params.id,
    req,
  });
  return success(res, data, { message: 'تم إنهاء الجلسة.' });
});

const endOtherSessions = handler(async (req, res) => {
  const data = await sessionManagement.endOtherOwnSessions({
    userId: req.user.userId,
    currentSessionId: req.authSession.id,
  });
  return success(res, data, { message: 'تم إنهاء جميع الجلسات الأخرى.' });
});

// ── administrative (users module routes) ───────────────────────────────────

const adminStatus = handler(async (req, res) => {
  const data = await mfaService.adminGetUserMfaStatus({ requester: req.user, targetUserId: req.params.id, req });
  return success(res, data, { message: 'OK' });
});

const adminReset = handler(async (req, res) => {
  const data = await mfaService.adminResetUserMfa({
    requester: req.user,
    targetUserId: req.validated.params.id,
    reason: req.validated.body.reason,
    req,
  });
  return success(res, data, { message: 'تمت إعادة تعيين المصادقة الثنائية وإنهاء جميع جلسات المستخدم.' });
});

module.exports = {
  noStore,
  verifyChallenge,
  cancelChallenge,
  enrollStart,
  enrollVerify,
  enrollComplete,
  status,
  setupStart,
  setupVerify,
  regenerateRecoveryCodes,
  disable,
  stepUp,
  listSessions,
  endSession,
  endOtherSessions,
  adminStatus,
  adminReset,
};
