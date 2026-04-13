const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const cohortsController = require('./cohorts.controller');
const enrollmentsController = require('../enrollments/enrollments.controller');
const sessionsController = require('../sessions/sessions.controller');
const {
  uuidParamSchema,
  listCohortsQuerySchema,
  createCohortBodySchema,
  updateCohortBodySchema,
  patchCohortStatusBodySchema,
} = require('./cohorts.validation');
const { createEnrollmentBodySchema } = require('../enrollments/enrollments.validation');
const { createSessionBodySchema } = require('../sessions/sessions.validation');

const router = express.Router();

const deliveryRead = authorizeRoles(...env.DELIVERY_READ_ROLE_CODES);
const deliveryWrite = authorizeRoles(...env.DELIVERY_WRITE_ROLE_CODES);

router.get(
  '/',
  authenticate,
  deliveryRead,
  validateRequest({ query: listCohortsQuerySchema }),
  cohortsController.list
);

router.post(
  '/',
  authenticate,
  deliveryWrite,
  validateRequest({ body: createCohortBodySchema }),
  cohortsController.create
);

router.get(
  '/:id/enrollments',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  enrollmentsController.listByCohort
);

router.post(
  '/:id/enrollments',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: createEnrollmentBodySchema }),
  enrollmentsController.createForCohort
);

router.get(
  '/:id/sessions',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  sessionsController.listByCohort
);

router.post(
  '/:id/sessions',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: createSessionBodySchema }),
  sessionsController.createForCohort
);

router.get(
  '/:id/attendance-summary',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  cohortsController.attendanceSummary
);

router.patch(
  '/:id/status',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: patchCohortStatusBodySchema }),
  cohortsController.patchStatus
);

router.put(
  '/:id',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: updateCohortBodySchema }),
  cohortsController.update
);

router.get(
  '/:id',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  cohortsController.getById
);

module.exports = router;
