const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminFieldTrainingController = require('./adminFieldTraining.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  submissionIdParamSchema,
  listAdminQuerySchema,
  listAdminStatsQuerySchema,
  listApplicationsQuerySchema,
  opportunityBodySchema,
  updateOpportunityBodySchema,
  reviewApplicationBodySchema,
  taskIdParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
  sessionIdParamSchema,
  sessionBodySchema,
  updateSessionBodySchema,
  saveAttendanceBodySchema,
  assessmentTypeParamSchema,
  assessmentIdParamSchema,
  assessmentBodySchema,
  createAssessmentBodySchema,
  updateAssessmentBodySchema,
  expelBodySchema,
  reviewSubmissionBodySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
const fieldTrainingAdmin = authorizeRoles(...env.FIELD_TRAINING_ADMIN_ROLE_CODES);
const fieldTrainingManage = authorizeRoles(...env.FIELD_TRAINING_MANAGE_ROLE_CODES);

router.use('/reports', require('./adminFieldTrainingReports.routes'));

router.get(
  '/eligibility-catalog',
  authenticate,
  fieldTrainingAdmin,
  adminFieldTrainingController.eligibilityCatalog
);

router.get(
  '/instructors',
  authenticate,
  fieldTrainingAdmin,
  workflowController.listInstructors
);

router.get(
  '/stats',
  authenticate,
  fieldTrainingManage,
  validateRequest({ query: listAdminStatsQuerySchema }),
  adminFieldTrainingController.stats
);

router.patch(
  '/applications/:applicationId/status',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: applicationIdParamSchema, body: reviewApplicationBodySchema }),
  adminFieldTrainingController.reviewApplication
);

router.post(
  '/applications/:applicationId/expel',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: applicationIdParamSchema, body: expelBodySchema }),
  workflowController.expelParticipant
);

router.post(
  '/applications/:applicationId/issue-completion-letter',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.issueCompletionLetter
);

router.get(
  '/applications/:applicationId/progress',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationProgress
);

router.get(
  '/',
  authenticate,
  fieldTrainingManage,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.post(
  '/',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ body: opportunityBodySchema }),
  adminFieldTrainingController.create
);

router.get(
  '/submissions/:submissionId/download-url',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.getSubmissionDownloadUrl
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.downloadSubmission
);

router.get(
  '/tasks/:taskId/instruction-file/download-url',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.getTaskInstructionDownloadUrl
);

router.get(
  '/tasks/:taskId/instruction-file/download',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.downloadTaskInstruction
);

router.patch(
  '/submissions/:submissionId/review',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: submissionIdParamSchema, body: reviewSubmissionBodySchema }),
  adminFieldTrainingController.reviewSubmission
);

router.post(
  '/:id/start-training',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  workflowController.startTraining
);

router.get(
  '/:id/sessions',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listSessions
);

router.post(
  '/:id/sessions',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema, body: sessionBodySchema }),
  workflowController.createSession
);

router.get(
  '/sessions/:sessionId/participants',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.listSessionParticipants
);

router.get(
  '/sessions/:sessionId/attendance',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getSessionAttendance
);

router.post(
  '/sessions/:sessionId/attendance',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: sessionIdParamSchema, body: saveAttendanceBodySchema }),
  workflowController.saveAttendance
);

router.patch(
  '/sessions/:sessionId',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: sessionIdParamSchema, body: updateSessionBodySchema }),
  workflowController.updateSession
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.deleteSession
);

router.put(
  '/:id/assessments/:type',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: assessmentTypeParamSchema, body: assessmentBodySchema }),
  workflowController.upsertAssessment
);

router.get(
  '/:id/assessments',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listOpportunityAssessments
);

router.post(
  '/:id/assessments',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema, body: createAssessmentBodySchema }),
  workflowController.createOpportunityAssessment
);

router.patch(
  '/assessments/:assessmentId',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: assessmentIdParamSchema, body: updateAssessmentBodySchema }),
  workflowController.updateAssessment
);

router.post(
  '/assessments/:assessmentId/publish',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: assessmentIdParamSchema }),
  workflowController.publishAssessmentById
);

router.post(
  '/:id/assessments/:type/publish',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: assessmentTypeParamSchema }),
  workflowController.publishAssessment
);

router.get(
  '/:id/applications',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema, query: listApplicationsQuerySchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/tasks',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listTasks
);

router.post(
  '/:id/tasks',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema, body: taskBodySchema }),
  adminFieldTrainingController.createTask
);

router.get(
  '/:id/submissions',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listSubmissions
);

router.patch(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  adminFieldTrainingController.updateTask
);

router.delete(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.deleteTask
);

router.get(
  '/:id',
  authenticate,
  fieldTrainingManage,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

router.patch(
  '/:id',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema, body: updateOpportunityBodySchema }),
  adminFieldTrainingController.update
);

router.post(
  '/:id/publish',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.publish
);

router.post(
  '/:id/archive',
  authenticate,
  fieldTrainingAdmin,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.archive
);

module.exports = router;
