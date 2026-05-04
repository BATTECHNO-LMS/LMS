const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const enrollmentsController = require('./enrollments.controller');
const {
  uuidParamSchema,
  patchEnrollmentStatusBodySchema,
  requestEnrollmentBodySchema,
  rejectEnrollmentBodySchema,
} = require('./enrollments.validation');

const router = express.Router();

const deliveryRead = authorizeRoles(...env.DELIVERY_READ_ROLE_CODES);
const deliveryWrite = authorizeRoles(...env.DELIVERY_WRITE_ROLE_CODES);
const enrollmentDecide = authorizeRoles(...env.ENROLLMENT_DECISION_ROLE_CODES);
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get('/me', authenticate, studentOnly, enrollmentsController.listMine);

router.get('/pending', authenticate, enrollmentDecide, enrollmentsController.listPending);

router.post(
  '/request',
  authenticate,
  studentOnly,
  validateRequest({ body: requestEnrollmentBodySchema }),
  enrollmentsController.requestEnrollment
);

router.patch(
  '/:id/approve',
  authenticate,
  enrollmentDecide,
  validateRequest({ params: uuidParamSchema }),
  enrollmentsController.approve
);

router.patch(
  '/:id/reject',
  authenticate,
  enrollmentDecide,
  validateRequest({ params: uuidParamSchema, body: rejectEnrollmentBodySchema }),
  enrollmentsController.reject
);

router.get(
  '/:id',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  enrollmentsController.getById
);

router.patch(
  '/:id/status',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: patchEnrollmentStatusBodySchema }),
  enrollmentsController.patchStatus
);

module.exports = router;
