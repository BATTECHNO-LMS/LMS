const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const reportController = require('./fieldTrainingReport.controller');
const {
  reportFiltersSchema,
  applicationIdParamSchema,
} = require('./fieldTrainingReport.validation');
const { taskIdParamSchema } = require('./fieldTraining.validation');

const router = express.Router();
const academicRoles = authorizeRoles(
  'academic_admin',
  'university_reviewer',
  'qa_officer',
  'university_admin'
);

router.get(
  '/reports/university',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicUniversityReport
);
router.get(
  '/reports/university/export/pdf',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicExportUniversityPdf
);
router.get(
  '/reports/university/export/excel',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicExportUniversityExcel
);
router.get(
  '/students',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicStudentsList
);
router.get(
  '/reports/students/:applicationId',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicStudentReport
);
router.get(
  '/reports/students/:applicationId/export/pdf',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicExportStudentPdf
);
router.get(
  '/reports/students/:applicationId/export/excel',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicExportStudentExcel
);
router.get(
  '/tasks/:taskId/instruction-file/download-url',
  authenticate,
  academicRoles,
  validateRequest({ params: taskIdParamSchema }),
  reportController.academicTaskInstructionDownloadUrl
);
router.get(
  '/tasks/:taskId/instruction-file/download',
  authenticate,
  academicRoles,
  validateRequest({ params: taskIdParamSchema }),
  reportController.academicDownloadTaskInstruction
);

module.exports = router;
