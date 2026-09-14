const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const analyticsController = require('./analytics.controller');
const { analyticsQuerySchema, commandCenterQuerySchema } = require('./analytics.validation');

const router = express.Router();
const superAdminOnly = authorizeRoles('super_admin');
const commandCenterRead = authorizeRoles('super_admin', 'admin');
const fieldTrainingAnalyticsRead = authorizeRoles('super_admin', ...env.REPORT_READ_ROLE_CODES);

router.get(
  '/command-center',
  authenticate,
  commandCenterRead,
  validateRequest({ query: commandCenterQuerySchema }),
  analyticsController.commandCenterOverview
);
router.get(
  '/command-center/live',
  authenticate,
  commandCenterRead,
  validateRequest({ query: commandCenterQuerySchema }),
  analyticsController.commandCenterLiveStream
);
router.get(
  '/command-center/live-snapshot',
  authenticate,
  commandCenterRead,
  validateRequest({ query: commandCenterQuerySchema }),
  analyticsController.commandCenterLiveSnapshot
);
router.get(
  '/command-center/filters',
  authenticate,
  commandCenterRead,
  validateRequest({ query: commandCenterQuerySchema }),
  analyticsController.commandCenterFilters
);
router.get(
  '/command-center/drilldown',
  authenticate,
  commandCenterRead,
  validateRequest({ query: commandCenterQuerySchema }),
  analyticsController.commandCenterDrilldown
);

router.get('/overview', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.overview);
router.get('/universities', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.universities);
router.get('/enrollments', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.enrollments);
router.get('/cohorts', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.cohorts);
router.get('/assessments', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.assessments);
router.get('/attendance', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.attendance);
router.get('/evidence', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.evidence);
router.get('/qa-integrity', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.qaIntegrity);
router.get('/recognition', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.recognition);
router.get('/certificates', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.certificates);
router.get('/field-training', authenticate, fieldTrainingAnalyticsRead, validateRequest({ query: analyticsQuerySchema }), analyticsController.fieldTraining);
router.get('/export/pdf', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.exportPdf);
router.get('/export/excel', authenticate, superAdminOnly, validateRequest({ query: analyticsQuerySchema }), analyticsController.exportExcel);

module.exports = router;
