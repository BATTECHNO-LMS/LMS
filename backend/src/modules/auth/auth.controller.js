const authService = require('./auth.service');
const authSessions = require('./authSession.service');
const { created, success, okMessage } = require('../../utils/apiResponse');
const { verifyToken } = require('../../utils/jwt');
const { extractBearerToken } = require('../../middlewares/auth.middleware');
const { truncateUserAgent } = require('../../shared/requestContext');

async function register(req, res, next) {
  try {
    const data = await authService.register(req.validated);
    return created(res, data, {
      message: 'تم إنشاء الحساب. يرجى توثيق البريد الإلكتروني باستخدام الرمز المرسل.',
    });
  } catch (e) {
    return next(e);
  }
}

async function registerInstitution(req, res, next) {
  try {
    const data = await authService.registerInstitution(req.validated);
    return created(res, data, {
      message: 'تم إنشاء الحساب. يرجى توثيق البريد الإلكتروني باستخدام الرمز المرسل.',
    });
  } catch (e) {
    return next(e);
  }
}

async function login(req, res, next) {
  try {
    const data = await authService.login({
      ...req.validated,
      ipAddress: req.ip || null,
      userAgent: truncateUserAgent(req.headers['user-agent']),
    });
    return success(res, data, { message: 'تم تسجيل الدخول بنجاح.' });
  } catch (e) {
    return next(e);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.me(req.user.userId, {
      portalType: req.user.portalType || null,
      authContext: req.user,
    });
    return success(res, { user }, { message: 'تم تحميل بيانات الحساب.' });
  } catch (e) {
    return next(e);
  }
}

async function listMyAssignments(req, res, next) {
  try {
    const data = await authService.listMyAssignments(req.user.userId);
    return success(res, data, { message: 'تم تحميل الجهات المرتبطة.' });
  } catch (e) {
    return next(e);
  }
}

async function setActiveOrganization(req, res, next) {
  try {
    const user = await authService.setActiveOrganization(
      req.user.userId,
      req.validated.body.organization_id
    );
    return success(res, { user }, { message: 'تم تفعيل الجهة المحددة.' });
  } catch (e) {
    return next(e);
  }
}

/**
 * Logout ends the server-side session referenced by the token (if it is still open), so
 * the same JWT is rejected afterwards. Idempotent: an expired/unknown token still gets 200.
 */
async function logout(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (token) {
      let payload = null;
      try {
        payload = verifyToken(token);
      } catch {
        payload = null;
      }
      if (payload?.sid && payload?.userId) {
        const row = await authSessions.getSessionById(payload.sid);
        if (row && row.user_id === payload.userId) {
          await authSessions.endSession(row, authSessions.SESSION_END_REASONS.USER_LOGOUT, {
            actorUserId: payload.userId,
            detectedBy: 'user',
          });
        }
      }
    }
    const { message } = authService.logout();
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

/** GET /auth/session — idle/absolute timing for the current session. */
function sessionStatus(req, res) {
  return success(res, { session: authSessions.describeSession(req.authSession) }, { message: 'OK' });
}

/** POST /auth/session/activity — real human activity (throttled client + server side). */
async function sessionActivity(req, res, next) {
  try {
    const { session } = await authSessions.recordActivity(req.authSession);
    return success(res, { session: authSessions.describeSession(session) }, { message: 'OK' });
  } catch (e) {
    return next(e);
  }
}

/** POST /auth/session/presence — tab visible; updates last_seen_at only. */
async function sessionPresence(req, res, next) {
  try {
    await authSessions.recordPresence(req.authSession);
    return success(res, { session: authSessions.describeSession(req.authSession) }, { message: 'OK' });
  } catch (e) {
    return next(e);
  }
}

const CLIENT_IDLE_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * POST /auth/sessions/current/end — explicit "end session" (USER_LOGOUT), or the client's
 * idle-timeout logout. A client-reported IDLE_TIMEOUT is only recorded as such when the
 * server's own last_activity_at agrees (within a small clock tolerance).
 */
async function endCurrentSession(req, res, next) {
  try {
    const row = req.authSession;
    const requested = typeof req.body?.reason === 'string' ? req.body.reason.toUpperCase() : 'USER_LOGOUT';
    let endReason = authSessions.SESSION_END_REASONS.USER_LOGOUT;
    let endedAt;
    if (requested === 'IDLE_TIMEOUT') {
      const cfg = authSessions.sessionConfig();
      const lastActivityMs = new Date(row.last_activity_at).getTime();
      if (Date.now() - lastActivityMs >= cfg.idleTimeoutMs - CLIENT_IDLE_TOLERANCE_MS) {
        endReason = authSessions.SESSION_END_REASONS.IDLE_TIMEOUT;
        endedAt = new Date(Math.min(Date.now(), lastActivityMs + cfg.idleTimeoutMs));
      }
    }
    await authSessions.endSession(row, endReason, {
      actorUserId: req.user.userId,
      detectedBy: endReason === authSessions.SESSION_END_REASONS.IDLE_TIMEOUT ? 'client' : 'user',
      endedAt,
    });
    return success(res, { ended: true, endReason }, { message: 'تم إنهاء الجلسة.' });
  } catch (e) {
    return next(e);
  }
}

async function registrationUniversities(_req, res, next) {
  try {
    const data = await authService.universitiesForRegistration();
    return success(res, data, { message: 'تم تحميل الجامعات المتاحة.' });
  } catch (e) {
    return next(e);
  }
}

async function registrationSpecialties(_req, res, next) {
  try {
    const data = await authService.specialtiesForRegistration();
    return success(res, data, { message: 'تم تحميل التخصصات.' });
  } catch (e) {
    return next(e);
  }
}

async function registrationUniversitySpecialties(req, res, next) {
  try {
    const specialties = await authService.universitySpecialtiesForRegistration(
      req.validated.params.universityId
    );
    return success(res, specialties, { message: 'تم تحميل تخصصات الجامعة.' });
  } catch (e) {
    return next(e);
  }
}

async function verifyEmailOtp(req, res, next) {
  try {
    const data = await authService.verifyEmailOtp(req.validated);
    const message = data.requiresAdminApproval
      ? 'تم توثيق البريد الإلكتروني بنجاح. حسابك الآن بانتظار موافقة الإدارة.'
      : 'تم توثيق البريد الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.';
    return success(res, data, { message });
  } catch (e) {
    return next(e);
  }
}

async function resendEmailOtp(req, res, next) {
  try {
    const { message } = await authService.resendEmailOtp(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { message } = await authService.forgotPassword(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function verifyPasswordResetOtp(req, res, next) {
  try {
    const { message, resetToken } = await authService.verifyPasswordResetOtp(req.validated);
    return success(res, { resetToken }, { message });
  } catch (e) {
    return next(e);
  }
}

async function resendPasswordResetOtp(req, res, next) {
  try {
    const { message } = await authService.resendPasswordResetOtp(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { message } = await authService.resetPassword(req.validated);
    return okMessage(res, message);
  } catch (e) {
    return next(e);
  }
}

async function accountStatus(req, res, next) {
  try {
    const data = await authService.accountStatus(req.validated);
    return success(res, data, { message: 'تم تحميل حالة الحساب.' });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  register,
  registerInstitution,
  login,
  me,
  listMyAssignments,
  setActiveOrganization,
  logout,
  sessionStatus,
  sessionActivity,
  sessionPresence,
  endCurrentSession,
  registrationUniversities,
  registrationSpecialties,
  registrationUniversitySpecialties,
  verifyEmailOtp,
  resendEmailOtp,
  forgotPassword,
  verifyPasswordResetOtp,
  resendPasswordResetOtp,
  resetPassword,
  accountStatus,
};
