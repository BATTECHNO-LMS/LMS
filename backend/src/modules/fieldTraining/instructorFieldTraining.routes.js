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
  listAdminQuerySchema,
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
  submissionIdParamSchema,
  reviewSubmissionBodySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
const instructorOnly = authorizeRoles(...env.FIELD_TRAINING_INSTRUCTOR_ROLE_CODES);

router.get(
  '/',
  authenticate,
  instructorOnly,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.get(
  '/submissions/:submissionId/download-url',
  authenticate,
  instructorOnly,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.getSubmissionDownloadUrl
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  instructorOnly,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.downloadSubmission
);

router.patch(
  '/submissions/:submissionId/review',
  authenticate,
  instructorOnly,
  validateRequest({ params: submissionIdParamSchema, body: reviewSubmissionBodySchema }),
  adminFieldTrainingController.reviewSubmission
);

router.post(
  '/:id/start-training',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  workflowController.startTraining
);

router.get(
  '/:id/sessions',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listSessions
);

router.post(
  '/:id/sessions',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema, body: sessionBodySchema }),
  workflowController.createSession
);

router.get(
  '/sessions/:sessionId/participants',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.listSessionParticipants
);

router.get(
  '/sessions/:sessionId/attendance',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getSessionAttendance
);

router.post(
  '/sessions/:sessionId/attendance',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema, body: saveAttendanceBodySchema }),
  workflowController.saveAttendance
);

router.patch(
  '/sessions/:sessionId',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema, body: updateSessionBodySchema }),
  workflowController.updateSession
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.deleteSession
);

router.put(
  '/:id/assessments/:type',
  authenticate,
  instructorOnly,
  validateRequest({ params: assessmentTypeParamSchema, body: assessmentBodySchema }),
  workflowController.upsertAssessment
);

router.get(
  '/:id/assessments',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listOpportunityAssessments
);

router.post(
  '/:id/assessments',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema, body: createAssessmentBodySchema }),
  workflowController.createOpportunityAssessment
);

router.patch(
  '/assessments/:assessmentId',
  authenticate,
  instructorOnly,
  validateRequest({ params: assessmentIdParamSchema, body: updateAssessmentBodySchema }),
  workflowController.updateAssessment
);

router.post(
  '/assessments/:assessmentId/publish',
  authenticate,
  instructorOnly,
  validateRequest({ params: assessmentIdParamSchema }),
  workflowController.publishAssessmentById
);

router.post(
  '/:id/assessments/:type/publish',
  authenticate,
  instructorOnly,
  validateRequest({ params: assessmentTypeParamSchema }),
  workflowController.publishAssessment
);

router.get(
  '/applications/:applicationId/progress',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationProgress
);

router.post(
  '/applications/:applicationId/expel',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema, body: expelBodySchema }),
  workflowController.expelParticipant
);

router.get(
  '/:id/applications',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/tasks',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listTasks
);

router.post(
  '/:id/tasks',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema, body: taskBodySchema }),
  adminFieldTrainingController.createTask
);

router.get(
  '/:id/submissions',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listSubmissions
);

router.patch(
  '/tasks/:taskId',
  authenticate,
  instructorOnly,
  validateRequest({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  adminFieldTrainingController.updateTask
);

router.delete(
  '/tasks/:taskId',
  authenticate,
  instructorOnly,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.deleteTask
);

router.get(
  '/:id',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

module.exports = router;
