const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const reportController = require('./fieldTrainingReport.controller');
const {
  reportFiltersSchema,
  exportFormatSchema,
  applicationIdParamSchema,
} = require('./fieldTrainingReport.validation');

const router = express.Router();
const reportRead = authorizeRoles(...env.REPORT_READ_ROLE_CODES);
const globalReportRead = authorizeRoles('super_admin');

router.get('/', authenticate, reportRead, validateRequest({ query: reportFiltersSchema }), reportController.dashboard);
router.get('/global', authenticate, globalReportRead, validateRequest({ query: reportFiltersSchema }), reportController.globalReport);
router.get(
  '/global/export/pdf',
  authenticate,
  globalReportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.exportGlobalPdf
);
router.get(
  '/global/export/excel',
  authenticate,
  globalReportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.exportGlobalExcel
);
router.get(
  '/university',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.universityReport
);
router.post(
  '/university/generate',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.generateUniversity
);
router.post(
  '/university/regenerate',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.generateUniversity
);
router.get(
  '/university/export/pdf',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.exportUniversityPdf
);
router.get(
  '/university/export/excel',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.exportUniversityExcel
);
router.get(
  '/students',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.studentsList
);
router.get(
  '/students/export/excel',
  authenticate,
  reportRead,
  validateRequest({ query: reportFiltersSchema }),
  reportController.exportStudentsExcel
);
router.get(
  '/students/:applicationId',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.studentReport
);
router.post(
  '/students/:applicationId/generate',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.generateStudent
);
router.post(
  '/students/:applicationId/regenerate',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.generateStudent
);
router.get(
  '/students/:applicationId/export/pdf',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.exportStudentPdf
);
router.get(
  '/students/:applicationId/export/excel',
  authenticate,
  reportRead,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.exportStudentExcel
);

module.exports = router;
