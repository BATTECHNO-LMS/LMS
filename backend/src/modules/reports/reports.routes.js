const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const reportsController = require('./reports.controller');
const { reportsQuerySchema, reportTypeParamSchema } = require('./reports.validation');

const router = express.Router();
const reportRead = authorizeRoles(...env.REPORT_READ_ROLE_CODES);

router.get('/universities', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.universities);
router.get('/cohorts', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.cohorts);
router.get('/attendance', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.attendance);
router.get('/assessments', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.assessments);
router.get('/recognition', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.recognition);
router.get('/certificates', authenticate, reportRead, validateRequest({ query: reportsQuerySchema }), reportsController.certificates);
router.get(
  '/:type/export',
  authenticate,
  reportRead,
  validateRequest({ params: reportTypeParamSchema, query: reportsQuerySchema }),
  reportsController.exportByType
);

module.exports = router;
