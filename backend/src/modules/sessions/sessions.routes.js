const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const sessionsController = require('./sessions.controller');
const {
  uuidParamSchema,
  updateSessionBodySchema,
  patchDocumentationBodySchema,
} = require('./sessions.validation');
const { saveAttendanceBodySchema } = require('../attendance/attendance.validation');

const router = express.Router();

const deliveryRead = authorizeRoles(...env.DELIVERY_READ_ROLE_CODES);
const deliveryWrite = authorizeRoles(...env.DELIVERY_WRITE_ROLE_CODES);
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get('/me', authenticate, studentOnly, sessionsController.listMine);

router.get(
  '/:id/attendance',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  sessionsController.getAttendance
);

router.post(
  '/:id/attendance',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: saveAttendanceBodySchema }),
  sessionsController.saveAttendance
);

router.patch(
  '/:id/documentation-status',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: patchDocumentationBodySchema }),
  sessionsController.patchDocumentation
);

router.put(
  '/:id',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: updateSessionBodySchema }),
  sessionsController.update
);

router.get(
  '/:id',
  authenticate,
  deliveryRead,
  validateRequest({ params: uuidParamSchema }),
  sessionsController.getById
);

module.exports = router;
