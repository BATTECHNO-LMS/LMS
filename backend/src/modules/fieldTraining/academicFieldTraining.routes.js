const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const reportController = require('./fieldTrainingReport.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const {
  reportFiltersSchema,
  applicationIdParamSchema,
} = require('./fieldTrainingReport.validation');
const { taskIdParamSchema, opportunityIdParamSchema } = require('./fieldTraining.validation');

const router = express.Router();
router.use(authenticate);
router.use(requireOrganizationType('UNIVERSITY'));
const academicRoles = authorizeRoles('admin', 'reviewer');

router.get(
  '/dashboard',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicDashboard
);
router.get(
  '/opportunities',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicOpportunitiesList
);
router.get(
  '/opportunities/:opportunityId',
  authenticate,
  academicRoles,
  validateRequest({
    params: opportunityIdParamSchema,
    query: reportFiltersSchema,
  }),
  reportController.academicOpportunityDetail
);
router.get(
  '/reports/university',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicUniversityReport
);
router.post(
  '/reports/university/generate',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicGenerateUniversity
);
router.post(
  '/reports/university/regenerate',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicGenerateUniversity
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
  '/students/export/excel',
  authenticate,
  academicRoles,
  validateRequest({ query: reportFiltersSchema }),
  reportController.academicExportStudentsExcel
);
router.get(
  '/applications/:applicationId/completion-letter/preview',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.previewCompletionLetterAsAcademic
);
router.get(
  '/applications/:applicationId/completion-letter/download',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.downloadCompletionLetterAsAcademic
);
router.get(
  '/reports/students/:applicationId',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicStudentReport
);
router.post(
  '/reports/students/:applicationId/generate',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicGenerateStudent
);
router.post(
  '/reports/students/:applicationId/regenerate',
  authenticate,
  academicRoles,
  validateRequest({ params: applicationIdParamSchema }),
  reportController.academicGenerateStudent
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

const evaluationRoutes = require('./fieldTrainingEvaluation.routes');
evaluationRoutes.mountReadRoutes(router, academicRoles);

module.exports = router;
