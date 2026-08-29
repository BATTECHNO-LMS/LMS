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
  reviewSubmissionBodySchema,
  updateApplicationHoursBodySchema,
} = require('./fieldTraining.validation');

const router = express.Router();
router.use(authenticate);
router.use(requireOrganizationType('UNIVERSITY'));
/** Admin FT portal only — instructors use `/instructor/field-training`. */
const fieldTrainingStaff = authorizeRoles(
  ...env.FIELD_TRAINING_ADMIN_ROLE_CODES,
  ...env.FIELD_TRAINING_MANAGE_ROLE_CODES
);

router.use('/reports', require('./adminFieldTrainingReports.routes'));

const evaluationRoutes = require('./fieldTrainingEvaluation.routes');
evaluationRoutes.mountReadRoutes(router, fieldTrainingStaff);
evaluationRoutes.mountWriteRoutes(router, fieldTrainingStaff);

/* -------- Static paths (must be before /:id) -------- */

router.get(
  '/eligibility-catalog',
  authenticate,
  fieldTrainingStaff,
  adminFieldTrainingController.eligibilityCatalog
);

router.get(
  '/instructors',
  authenticate,
  fieldTrainingStaff,
  workflowController.listInstructors
);

router.get(
  '/stats',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ query: listAdminStatsQuerySchema }),
  adminFieldTrainingController.stats
);

router.get(
  '/',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ query: listAdminQuerySchema }),
  adminFieldTrainingController.list
);

router.post(
  '/',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ body: opportunityBodySchema }),
  adminFieldTrainingController.create
);

router.patch(
  '/applications/:applicationId/status',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema, body: reviewApplicationBodySchema }),
  adminFieldTrainingController.reviewApplication
);

router.post(
  '/applications/:applicationId/expel',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema, body: expelBodySchema }),
  workflowController.expelParticipant
);

router.post(
  '/applications/:applicationId/issue-completion-letter',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.issueCompletionLetter
);

router.get(
  '/applications/:applicationId/completion-letter/download',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.downloadCompletionLetterAsManager
);

router.get(
  '/applications/:applicationId/progress',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationProgress
);

router.get(
  '/applications/:applicationId/hours',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationHours
);

router.patch(
  '/applications/:applicationId/hours',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema, body: updateApplicationHoursBodySchema }),
  workflowController.updateApplicationHours
);

router.post(
  '/applications/:applicationId/recalculate-eligibility',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.recalculateEligibility
);

router.get(
  '/submissions/:submissionId/download-url',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.getSubmissionDownloadUrl
);

router.get(
  '/submissions/:submissionId/download',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: submissionIdParamSchema }),
  adminFieldTrainingController.downloadSubmission
);

router.patch(
  '/submissions/:submissionId/review',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: submissionIdParamSchema, body: reviewSubmissionBodySchema }),
  adminFieldTrainingController.reviewSubmission
);

router.get(
  '/tasks/:taskId/instruction-file/download-url',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.getTaskInstructionDownloadUrl
);

router.get(
  '/tasks/:taskId/instruction-file/download',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.downloadTaskInstruction
);

router.patch(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: taskIdParamSchema, body: updateTaskBodySchema }),
  adminFieldTrainingController.updateTask
);

router.delete(
  '/tasks/:taskId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: taskIdParamSchema }),
  adminFieldTrainingController.deleteTask
);

router.get(
  '/sessions/:sessionId/participants',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.listSessionParticipants
);

router.get(
  '/sessions/:sessionId/attendance',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getSessionAttendance
);

router.post(
  '/sessions/:sessionId/attendance',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema, body: saveAttendanceBodySchema }),
  workflowController.saveAttendance
);

router.get(
  '/sessions/:sessionId/attendance-window',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance-window/open',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema, body: openAttendanceWindowBodySchema }),
  workflowController.openAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance-window/close',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.closeAttendanceWindow
);

router.post(
  '/sessions/:sessionId/attendance/finalize-absences',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.finalizeAttendanceAbsences
);

router.post(
  '/sessions/:sessionId/attendance/mark-all-present',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema, body: markAllPresentBodySchema }),
  workflowController.markAllPresent
);

router.patch(
  '/sessions/:sessionId/attendance/:studentId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({
    params: sessionIdParamSchema.merge(studentIdParamSchema),
    body: manualAttendanceBodySchema,
  }),
  workflowController.patchStudentAttendance
);

router.patch(
  '/sessions/:sessionId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema, body: updateSessionBodySchema }),
  workflowController.updateSession
);

router.delete(
  '/sessions/:sessionId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.deleteSession
);

router.patch(
  '/assessments/:assessmentId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: assessmentIdParamSchema, body: updateAssessmentBodySchema }),
  workflowController.updateAssessment
);

router.post(
  '/assessments/:assessmentId/publish',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: assessmentIdParamSchema }),
  workflowController.publishAssessmentById
);

router.post(
  '/assessment-attempts/:attemptId/grade',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: attemptIdParamSchema, body: gradeAttemptBodySchema }),
  workflowController.gradeAssessmentAttempt
);

/* -------- Dynamic opportunity id routes -------- */

router.get(
  '/:id/eligibility',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listEligibility
);

router.post(
  '/:id/start-training',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  workflowController.startTraining
);

router.get(
  '/:id/sessions',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listSessions
);

router.post(
  '/:id/sessions',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: sessionBodySchema }),
  workflowController.createSession
);

router.put(
  '/:id/assessments/:type',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: assessmentTypeParamSchema, body: assessmentBodySchema }),
  workflowController.upsertAssessment
);

router.get(
  '/:id/assessments',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  workflowController.listOpportunityAssessments
);

router.post(
  '/:id/assessments',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: createAssessmentBodySchema }),
  workflowController.createOpportunityAssessment
);

router.post(
  '/:id/assessments/:type/publish',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: assessmentTypeParamSchema }),
  workflowController.publishAssessment
);

router.get(
  '/:id/overview-summary',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.overviewSummary
);

router.get(
  '/:id/applications/export/excel',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, query: listApplicationsQuerySchema }),
  adminFieldTrainingController.exportApplicationsExcel
);

router.get(
  '/:id/applications',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, query: listApplicationsQuerySchema }),
  adminFieldTrainingController.listApplications
);

router.get(
  '/:id/tasks',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listTasks
);

router.post(
  '/:id/tasks',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: taskBodySchema }),
  adminFieldTrainingController.createTask
);

router.get(
  '/:id/submissions',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.listSubmissions
);

router.get(
  '/:id',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.getById
);

router.patch(
  '/:id',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: updateOpportunityBodySchema }),
  adminFieldTrainingController.update
);

router.post(
  '/:id/publish',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.publish
);

router.post(
  '/:id/archive',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  adminFieldTrainingController.archive
);

module.exports = router;
