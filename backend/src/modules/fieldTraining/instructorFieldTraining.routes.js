const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminFieldTrainingController = require('./adminFieldTraining.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  listAdminQuerySchema,
  listAdminStatsQuerySchema,
  taskIdParamSchema,
  taskBodySchema,
  updateTaskBodySchema,
  sessionIdParamSchema,
  sessionBodySchema,
  updateSessionBodySchema,
  saveAttendanceBodySchema,
  openAttendanceWindowBodySchema,
  manualAttendanceBodySchema,
  markAllPresentBodySchema,
  studentIdParamSchema,
  assessmentTypeParamSchema,
  assessmentIdParamSchema,
  attemptIdParamSchema,
  gradeAttemptBodySchema,
  assessmentBodySchema,
  createAssessmentBodySchema,
  updateAssessmentBodySchema,
  expelBodySchema,
  requestExpulsionBodySchema,
  submissionIdParamSchema,
  reviewSubmissionBodySchema,
  updateApplicationHoursBodySchema,
  listApplicationsQuerySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
router.use(authenticate);
router.use(requireOrganizationType('UNIVERSITY'));
const reportController = require('./fieldTrainingReport.controller');
const { applicationIdParamSchema: reportApplicationIdParamSchema } = require('./fieldTrainingReport.validation');
const instructorOnly = authorizeRoles(...env.FIELD_TRAINING_INSTRUCTOR_ROLE_CODES);

const evaluationRoutes = require('./fieldTrainingEvaluation.routes');
evaluationRoutes.mountReadRoutes(router, instructorOnly);
evaluationRoutes.mountWriteRoutes(router, instructorOnly);

/* -------- Static paths (must be before /:id) -------- */

router.get(
  '/reports/students/:applicationId',
  authenticate,
  instructorOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.studentReport
);
router.get(
  '/reports/students/:applicationId/export/pdf',
  authenticate,
  instructorOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.exportStudentPdf
);
router.get(
  '/reports/students/:applicationId/export/excel',
  authenticate,
  instructorOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.exportStudentExcel
);

router.get(
  '/',
  authenticate,
  instructorOnly,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.get(
  '/stats',
  authenticate,
  instructorOnly,
  validateRequest({ query: listAdminStatsQuerySchema }),
  adminFieldTrainingController.stats
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

router.get(
  '/tasks/:taskId/instruction-file/download-url',
  authenticate,
  instructorOnly,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.getTaskInstructionDownloadUrl
);

router.get(
  '/tasks/:taskId/instruction-file/download',
  authenticate,
  instructorOnly,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.downloadTaskInstruction
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

router.get(
  '/sessions/:sessionId/attendance-window',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance-window/open',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema, body: openAttendanceWindowBodySchema }),
  workflowController.openAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance-window/close',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.closeAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance/finalize-absences',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.finalizeAttendanceAbsences
);

router.post(
  '/sessions/:sessionId/attendance/mark-all-present',
  authenticate,
  instructorOnly,
  validateRequest({ params: sessionIdParamSchema, body: markAllPresentBodySchema }),
  workflowController.markAllPresent
);

router.patch(
  '/sessions/:sessionId/attendance/:studentId',
  authenticate,
  instructorOnly,
  validateRequest({
    params: sessionIdParamSchema.merge(studentIdParamSchema),
    body: manualAttendanceBodySchema,
  }),
  workflowController.patchStudentAttendance
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
  '/assessment-attempts/:attemptId/grade',
  authenticate,
  instructorOnly,
  validateRequest({ params: attemptIdParamSchema, body: gradeAttemptBodySchema }),
  workflowController.gradeAssessmentAttempt
);

router.get(
  '/applications/:applicationId/progress',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationProgress
);

router.get(
  '/applications/:applicationId/hours',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationHours
);

router.patch(
  '/applications/:applicationId/hours',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema, body: updateApplicationHoursBodySchema }),
  workflowController.updateApplicationHours
);

router.post(
  '/applications/:applicationId/recalculate-eligibility',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.recalculateEligibility
);

router.get(
  '/applications/:applicationId/completion-letter/download',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.downloadCompletionLetterAsManager
);

router.post(
  '/applications/:applicationId/expel',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema, body: expelBodySchema }),
  workflowController.expelParticipant
);

router.post(
  '/applications/:applicationId/request-expulsion',
  authenticate,
  instructorOnly,
  validateRequest({ params: applicationIdParamSchema, body: requestExpulsionBodySchema }),
  workflowController.requestExpulsion
);

/* -------- Dynamic opportunity id routes -------- */

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

router.post(
  '/:id/assessments/:type/publish',
  authenticate,
  instructorOnly,
  validateRequest({ params: assessmentTypeParamSchema }),
  workflowController.publishAssessment
);

router.get(
  '/:id/overview-summary',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.overviewSummary
);

router.get(
  '/:id/applications/export/excel',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema, query: listApplicationsQuerySchema }),
  adminFieldTrainingController.exportApplicationsExcel
);

router.get(
  '/:id/applications',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema, query: listApplicationsQuerySchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/eligibility',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listEligibility
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

router.get(
  '/:id',
  authenticate,
  instructorOnly,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

module.exports = router;
