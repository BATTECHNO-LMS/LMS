const express = require('express');
const { validateBody, validateRequest } = require('../../middlewares/validate.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
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
router.post('/verify-email-otp', validateBody(verifyEmailOtpSchema), authController.verifyEmailOtp);
router.post('/resend-email-otp', validateBody(resendEmailOtpSchema), authController.resendEmailOtp);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post(
  '/verify-password-reset-otp',
  validateBody(verifyPasswordResetOtpSchema),
  authController.verifyPasswordResetOtp
);
router.post(
  '/resend-password-reset-otp',
  validateBody(resendPasswordResetOtpSchema),
  authController.resendPasswordResetOtp
);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/login', validateBody(loginSchema), authController.login);
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

module.exports = router;
