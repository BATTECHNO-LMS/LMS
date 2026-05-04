const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const studentController = require('./student.controller');
const { enrollmentRequestBodySchema } = require('./student.validation');

const router = express.Router();
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get('/available-cohorts', authenticate, studentOnly, studentController.availableCohorts);

router.post(
  '/enrollment-requests',
  authenticate,
  studentOnly,
  validateRequest({ body: enrollmentRequestBodySchema }),
  studentController.createEnrollmentRequest
);

router.get('/semester-schedule', authenticate, studentOnly, studentController.semesterSchedule);

module.exports = router;
