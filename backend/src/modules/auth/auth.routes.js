const express = require('express');
const { validateBody } = require('../../middlewares/validate.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const {
  registerSchema,
  loginSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
} = require('./auth.validation');
const authController = require('./auth.controller');

const router = express.Router();

router.get('/register/universities', authController.registrationUniversities);
router.get('/register/specialties', authController.registrationSpecialties);
router.post('/register', validateBody(registerSchema), authController.register);
router.post('/verify-email-otp', validateBody(verifyEmailOtpSchema), authController.verifyEmailOtp);
router.post('/resend-email-otp', validateBody(resendEmailOtpSchema), authController.resendEmailOtp);
router.post('/login', validateBody(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.me);
router.post('/logout', authController.logout);

module.exports = router;
