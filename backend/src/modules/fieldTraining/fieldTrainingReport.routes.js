const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const controller = require('./fieldTrainingReport.controller');
const {
  dateRangeQuerySchema,
  exportFormatSchema,
  applicationIdParamSchema,
} = require('./fieldTrainingReport.validation');

const router = express.Router();
const reportRead = authorizeRoles(...env.REPORT_READ_ROLE_CODES);

router.get('/dashboard', authenticate, reportRead, validateRequest({ query: dateRangeQuerySchema }), controller.dashboard);
router.get('/university', authenticate, reportRead, validateRequest({ query: dateRangeQuerySchema }), controller.universityReport);
router.get(
  '/university/export',
  authenticate,
  reportRead,
  validateRequest({ query: exportFormatSchema }),
  controller.exportUniversity
);
router.get('/applications', authenticate, reportRead, validateRequest({ query: dateRangeQuerySchema }), controller.applications);
router.get(
  '/applications/:applicationId',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  controller.studentReport
);
router.get(
  '/applications/:applicationId/export',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema, query: exportFormatSchema }),
  controller.exportStudent
);

module.exports = router;
