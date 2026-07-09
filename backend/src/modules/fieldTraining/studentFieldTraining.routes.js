const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const studentFieldTrainingController = require('./studentFieldTraining.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  listStudentQuerySchema,
  applyBodySchema,
  taskIdParamSchema,
  submissionIdParamSchema,
  assessmentTypeParamSchema,
  assessmentIdParamSchema,
  submitAssessmentBodySchema,
  aiSelfEvalBodySchema,
} = require('./fieldTraining.validation');
const { handleTaskUpload } = require('./fieldTraining.upload');
const { aiSelfEvalLimiter } = require('./fieldTraining.aiRateLimit.middleware');

const router = express.Router();
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);

router.get(
  '/my-applications',
  authenticate,
  studentOnly,
  studentFieldTrainingController.myApplications
);

router.patch(
  '/applications/:applicationId/cancel',
  authenticate,
  studentOnly,
  validateRequest({ params: applicationIdParamSchema }),
  studentFieldTrainingController.cancel
);

router.get(
  '/',
  authenticate,
  studentOnly,
  validateRequest({ query: listStudentQuerySchema }),
  studentFieldTrainingController.list
);

router.get(
  '/submissions/:submissionId/download-url',
  authenticate,
  studentOnly,
  validateRequest({ params: submissionIdParamSchema }),
  studentFieldTrainingController.getSubmissionDownloadUrl
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  studentOnly,
  validateRequest({ params: submissionIdParamSchema }),
  studentFieldTrainingController.downloadSubmission
);

router.get(
  '/tasks/:taskId/instruction-file/download-url',
  authenticate,
  studentOnly,
  validateRequest({ params: taskIdParamSchema }),
  studentFieldTrainingController.getTaskInstructionDownloadUrl
);

router.get(
  '/tasks/:taskId/instruction-file/download',
  authenticate,
  studentOnly,
  validateRequest({ params: taskIdParamSchema }),
  studentFieldTrainingController.downloadTaskInstruction
);

router.post(
  '/tasks/:taskId/ai-self-evaluate',
  authenticate,
  studentOnly,
  aiSelfEvalLimiter,
  validateRequest({ params: taskIdParamSchema, body: aiSelfEvalBodySchema }),
  studentFieldTrainingController.aiSelfEvaluate
);

router.get(
  '/completion-letters/:applicationId/download',
  authenticate,
  studentOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.downloadCompletionLetter
);

router.post(
  '/assessments/:assessmentId/submit',
  authenticate,
  studentOnly,
  validateRequest({ params: assessmentIdParamSchema, body: submitAssessmentBodySchema }),
  workflowController.submitAssessmentById
);

router.get(
  '/:id/sessions',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentFieldTrainingController.listSessions
);

router.get(
  '/:id/progress',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  workflowController.getStudentProgress
);

router.get(
  '/:id/assessments',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listStudentAssessments
);

router.get(
  '/:id/assessments/:type',
  authenticate,
  studentOnly,
  validateRequest({ params: assessmentTypeParamSchema }),
  studentFieldTrainingController.getAssessment
);

router.post(
  '/:id/assessments/:type/submit',
  authenticate,
  studentOnly,
  validateRequest({ params: assessmentTypeParamSchema, body: submitAssessmentBodySchema }),
  studentFieldTrainingController.submitAssessment
);

router.get(
  '/:id/tasks',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentFieldTrainingController.listTasks
);

router.post(
  '/tasks/:taskId/submit',
  authenticate,
  studentOnly,
  validateRequest({ params: taskIdParamSchema }),
  handleTaskUpload,
  studentFieldTrainingController.submitTask
);

router.get(
  '/:id',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  studentFieldTrainingController.getById
);

router.post(
  '/:id/apply',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema, body: applyBodySchema }),
  studentFieldTrainingController.apply
);

module.exports = router;
