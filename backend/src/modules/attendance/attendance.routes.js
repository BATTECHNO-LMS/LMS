const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const attendanceController = require('./attendance.controller');
const { uuidParamSchema, patchAttendanceRecordBodySchema } = require('./attendance.validation');

const router = express.Router();

const deliveryWrite = authorizeRoles(...env.DELIVERY_WRITE_ROLE_CODES);

router.put(
  '/:id',
  authenticate,
  deliveryWrite,
  validateRequest({ params: uuidParamSchema, body: patchAttendanceRecordBodySchema }),
  attendanceController.updateRecord
);

module.exports = router;
