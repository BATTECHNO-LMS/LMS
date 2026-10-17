const express = require('express');
const { validateBody, validateRequest } = require('../../middlewares/validate.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const {
  credentialAttemptLimiter,
  otpAttemptLimiter,
  mfaAttemptLimiter,
} = require('../../middlewares/rateLimit.middleware');
const mfaController = require('./mfa/mfa.controller');
const mfaValidation = require('./mfa/mfa.validation');
const { loginThrottleGuard } = require('./loginThrottle.middleware');
const {
  registerSchema,
  institutionRegisterSchema,
  universityIdParamSchema,
  loginSchema,
  accountStatusSchema,
  activeOrganizationBodySchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  forgotPasswordSchema,
  verifyPasswordResetOtpSchema,
  resendPasswordResetOtpSchema,
  resetPasswordSchema,
} = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

router.get('/register/universities', authController.registrationUniversities);
router.get('/register/specialties', authController.registrationSpecialties);
router.get(
  '/register/universities/:universityId/specialties',
  validateRequest({ params: universityIdParamSchema }),
  authController.registrationUniversitySpecialties
);
router.post('/register', validateBody(registerSchema), authController.register);
router.post(
  '/institutions/register',
  validateBody(institutionRegisterSchema),
  authController.registerInstitution
);
router.post(
  '/verify-email-otp',
  otpAttemptLimiter,
  validateBody(verifyEmailOtpSchema),
  authController.verifyEmailOtp
);
router.post(
  '/resend-email-otp',
  otpAttemptLimiter,
  validateBody(resendEmailOtpSchema),
  authController.resendEmailOtp
);
router.post(
  '/forgot-password',
  credentialAttemptLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  '/verify-password-reset-otp',
  otpAttemptLimiter,
  validateBody(verifyPasswordResetOtpSchema),
  authController.verifyPasswordResetOtp
);
router.post(
  '/resend-password-reset-otp',
  otpAttemptLimiter,
  validateBody(resendPasswordResetOtpSchema),
  authController.resendPasswordResetOtp
);
router.post('/reset-password', otpAttemptLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
router.post(
  '/login',
  credentialAttemptLimiter,
  validateBody(loginSchema),
  loginThrottleGuard,
  authController.login
);
router.post('/account-status', validateBody(accountStatusSchema), authController.accountStatus);
router.get('/me', authMiddleware, authController.me);
router.get('/me/assignments', authMiddleware, authController.listMyAssignments);
router.post(
  '/me/active-organization',
  authMiddleware,
  validateBody(activeOrganizationBodySchema),
  authController.setActiveOrganization
);
router.post('/logout', authController.logout);
router.get('/session', authMiddleware, authController.sessionStatus);
router.post('/session/activity', authMiddleware, authController.sessionActivity);
router.post('/session/presence', authMiddleware, authController.sessionPresence);
router.post('/sessions/current/end', authMiddleware, authController.endCurrentSession);

// ── Security & sessions (own sessions only) ────────────────────────────────
router.get('/sessions', authMiddleware, mfaController.noStore, mfaController.listSessions);
router.post('/sessions/end-others', authMiddleware, mfaController.endOtherSessions);
router.post(
  '/sessions/:id/end',
  authMiddleware,
  validateRequest({ params: mfaValidation.sessionIdParamSchema }),
  mfaController.endSession
);

// ── MFA: pre-session challenge (password verified, no JWT yet) ─────────────
router.post(
  '/mfa/challenge/verify',
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.challengeVerifySchema),
  mfaController.verifyChallenge
);
router.post('/mfa/challenge/cancel', validateBody(mfaValidation.challengeOnlySchema), mfaController.cancelChallenge);
router.post(
  '/mfa/enroll/start',
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.challengeOnlySchema),
  mfaController.enrollStart
);
router.post(
  '/mfa/enroll/verify',
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.challengeCodeSchema),
  mfaController.enrollVerify
);
router.post(
  '/mfa/enroll/complete',
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.enrollCompleteSchema),
  mfaController.enrollComplete
);

// ── MFA: authenticated self-service ────────────────────────────────────────
router.get('/mfa/status', authMiddleware, mfaController.noStore, mfaController.status);
router.post(
  '/mfa/setup/start',
  authMiddleware,
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.setupStartSchema),
  mfaController.setupStart
);
router.post(
  '/mfa/setup/verify',
  authMiddleware,
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.codeOnlySchema),
  mfaController.setupVerify
);
router.post(
  '/mfa/recovery-codes/regenerate',
  authMiddleware,
  mfaAttemptLimiter,
  mfaController.noStore,
  validateBody(mfaValidation.passwordAndCodeSchema),
  mfaController.regenerateRecoveryCodes
);
router.post(
  '/mfa/disable',
  authMiddleware,
  mfaAttemptLimiter,
  validateBody(mfaValidation.passwordAndCodeSchema),
  mfaController.disable
);
router.post(
  '/mfa/step-up',
  authMiddleware,
  mfaAttemptLimiter,
  validateBody(mfaValidation.codeOnlySchema),
  mfaController.stepUp
);

module.exports = router;
