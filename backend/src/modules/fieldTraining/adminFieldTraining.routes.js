const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const adminFieldTrainingController = require('./adminFieldTraining.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const lettersController = require('./fieldTraining.lettersAndSupervisors.controller');
const {
  uuidParamSchema,
  applicationIdParamSchema,
  opportunityApplicationParamSchema,
  comprehensiveReportQuerySchema,
  submissionIdParamSchema,
  listAdminQuerySchema,
  listAdminStatsQuerySchema,
  listApplicationsQuerySchema,
  commandCenterQuerySchema,
  logbookEntryIdParamSchema,
  logbookAttachmentIdParamSchema,
  logbookListQuerySchema,
  logbookRevisionBodySchema,
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
  interventionOpenBodySchema,
  interventionFollowUpBodySchema,
  interventionAssignBodySchema,
  interventionResolveBodySchema,
  externalSupervisorAssignBodySchema,
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
  listCompletionLettersQuerySchema,
  bulkIssueBodySchema,
  bulkStudentReportsExportBodySchema,
  jobIdParamSchema,
  applySupervisorImportBodySchema,
  resolveSupervisorImportBodySchema,
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

const recordedLectureRoutes = require('./fieldTraining.recordedLectures.routes');
recordedLectureRoutes.mountManageRoutes(router, fieldTrainingStaff);

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
  '/:id/completion-letters',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, query: listCompletionLettersQuerySchema }),
  lettersController.listCompletionLetters
);

router.post(
  '/:id/completion-letters/preview-bulk-issue',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: bulkIssueBodySchema }),
  lettersController.previewBulkIssue
);

router.post(
  '/:id/completion-letters/bulk-issue',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: bulkIssueBodySchema }),
  lettersController.startBulkIssue
);

router.get(
  '/:id/completion-letters/jobs/:jobId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: jobIdParamSchema }),
  lettersController.getBulkIssueJob
);

router.post(
  '/:id/completion-letters/jobs/:jobId/retry',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: jobIdParamSchema }),
  lettersController.retryBulkIssueJob
);

router.get(
  '/:id/completion-letters/zip',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  lettersController.downloadIssuedZip
);

router.get(
  '/:id/academic-supervisors',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  lettersController.listAcademicSupervisors
);

router.get(
  '/:id/supervisor-assignments/template',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  lettersController.downloadSupervisorTemplate
);

router.post(
  '/:id/supervisor-assignments/preview',
  authenticate,
  fieldTrainingStaff,
  lettersController.handleExcelMulter,
  validateRequest({ params: uuidParamSchema }),
  lettersController.previewSupervisorImport
);

router.post(
  '/:id/supervisor-assignments/resolve',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: resolveSupervisorImportBodySchema }),
  lettersController.resolveSupervisorImport
);

router.post(
  '/:id/supervisor-assignments/apply',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: applySupervisorImportBodySchema }),
  lettersController.applySupervisorImport
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
  '/applications/:applicationId/completion-letter/preview',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.previewCompletionLetterAsManager
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
  '/applications/:applicationId/progress-snapshot',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.getApplicationProgressSnapshot
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

router.get(
  '/sessions/:sessionId/attendance-qr/live',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: sessionIdParamSchema }),
  workflowController.getLiveQrAttendance
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
  '/:id/reports/students/bulk-export/preview',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: bulkStudentReportsExportBodySchema }),
  workflowController.previewBulkStudentReports
);

router.post(
  '/:id/reports/students/bulk-export',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: bulkStudentReportsExportBodySchema }),
  workflowController.startBulkStudentReports
);

router.get(
  '/:id/reports/students/bulk-export/jobs/:jobId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: jobIdParamSchema }),
  workflowController.getBulkStudentReportsJob
);

router.get(
  '/:id/reports/students/bulk-export/jobs/:jobId/download',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: jobIdParamSchema }),
  workflowController.downloadBulkStudentReportsZip
);

router.get(
  '/:id/applications/:applicationId/comprehensive-report',
  authenticate,
  fieldTrainingStaff,
  validateRequest({
    params: opportunityApplicationParamSchema,
    query: comprehensiveReportQuerySchema,
  }),
  workflowController.getComprehensiveStudentReport
);

router.get(
  '/:id/applications/:applicationId/comprehensive-report/pdf',
  authenticate,
  fieldTrainingStaff,
  validateRequest({
    params: opportunityApplicationParamSchema,
    query: comprehensiveReportQuerySchema,
  }),
  workflowController.downloadComprehensiveStudentReportPdf
);

router.get(
  '/:id/reports/final',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const report = await require('./fieldTraining.cohortReports.service').buildOpportunityFinalReport(
        req.user,
        req.params.id,
        req.query || {}
      );
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/reports/comprehensive',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const report = await require('./fieldTraining.cohortReports.service').buildOpportunityComprehensiveReport(
        req.user,
        req.params.id,
        req.query || {}
      );
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/reports/validation',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const data = await require('./fieldTraining.cohortReports.service').validateOpportunityReport(
        req.user,
        req.params.id,
        req.query || {}
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

function sendBinaryExport(res, result) {
  const filename = result.filename || 'report.bin';
  const safeAscii = String(filename).replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  return res.send(result.buffer);
}

router.get(
  '/:id/reports/final/pdf',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const result = await require('./fieldTraining.cohortReports.service').exportOpportunityFinalReportPdf(
        req.user,
        req.params.id,
        req.query || {}
      );
      return sendBinaryExport(res, result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/reports/comprehensive/pdf',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const result = await require('./fieldTraining.cohortReports.service').exportOpportunityComprehensiveReportPdf(
        req.user,
        req.params.id,
        req.query || {}
      );
      return sendBinaryExport(res, result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/reports/export/excel',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const result = await require('./fieldTraining.cohortReports.service').exportOpportunityOfficialExcel(
        req.user,
        req.params.id,
        req.query || {}
      );
      return sendBinaryExport(res, result);
    } catch (err) {
      next(err);
    }
  }
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
  '/:id/command-center',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, query: commandCenterQuerySchema }),
  workflowController.getOpportunityCommandCenter
);

const interventionService = require('./fieldTraining.intervention.service');
const externalSupervisorService = require('./fieldTraining.externalSupervisor.service');
const { success } = require('../../utils/apiResponse');
const { z } = require('zod');

const caseIdParamSchema = z.object({ caseId: z.string().uuid() });
const assignmentIdParamSchema = z.object({ assignmentId: z.string().uuid() });

router.get(
  '/:id/interventions/kpis',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.getKpis(req.validated.params.id, req.user);
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/:id/interventions',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.listCases(req.validated.params.id, req.query, req.user);
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/:id/interventions',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: interventionOpenBodySchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.openCase(req.validated.body, req.user);
      return success(res, data, { message: data.duplicate ? 'Existing case' : 'Case opened' });
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/interventions/:caseId',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: caseIdParamSchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.getCase(req.validated.params.caseId, req.user);
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/interventions/:caseId/follow-up',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: caseIdParamSchema, body: interventionFollowUpBodySchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.addFollowUp(
        req.validated.params.caseId,
        req.validated.body,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/interventions/:caseId/assign',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: caseIdParamSchema, body: interventionAssignBodySchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.assignCase(
        req.validated.params.caseId,
        req.validated.body,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/interventions/:caseId/resolve',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: caseIdParamSchema, body: interventionResolveBodySchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.resolveCase(
        req.validated.params.caseId,
        req.validated.body,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/interventions/:caseId/reopen',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: caseIdParamSchema }),
  async (req, res, next) => {
    try {
      const data = await interventionService.reopenCase(
        req.validated.params.caseId,
        req.body || {},
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/:id/external-supervisors',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  async (req, res, next) => {
    try {
      const data = await externalSupervisorService.listAdminAssignments(
        req.validated.params.id,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/:id/external-supervisors',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, body: externalSupervisorAssignBodySchema }),
  async (req, res, next) => {
    try {
      const data = await externalSupervisorService.assignExternalSupervisor(
        { ...req.validated.body, opportunity_id: req.validated.params.id },
        req.user
      );
      return success(res, data, { message: 'External supervisor assigned' });
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/external-supervisors/:assignmentId/revoke',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: assignmentIdParamSchema }),
  async (req, res, next) => {
    try {
      const data = await externalSupervisorService.revokeAssignment(
        req.validated.params.assignmentId,
        req.user
      );
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

const logbookController = require('./fieldTraining.logbook.controller');

router.get(
  '/:id/logbook',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema, query: logbookListQuerySchema }),
  logbookController.staffList
);

router.post(
  '/logbook/:entryId/approve',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: logbookEntryIdParamSchema }),
  logbookController.staffApprove
);

router.post(
  '/logbook/:entryId/request-revision',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: logbookEntryIdParamSchema, body: logbookRevisionBodySchema }),
  logbookController.staffRequestRevision
);

router.get(
  '/logbook/attachments/:attachmentId/download',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: logbookAttachmentIdParamSchema }),
  logbookController.downloadAttachment
);

router.get(
  '/applications/:applicationId/portfolio',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  logbookController.getPortfolio
);

router.get(
  '/applications/:applicationId/portfolio/pdf',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: applicationIdParamSchema }),
  logbookController.downloadPortfolioPdf
);

router.post(
  '/:id/smart-notifications/evaluate',
  authenticate,
  fieldTrainingStaff,
  validateRequest({ params: uuidParamSchema }),
  logbookController.runSmartNotifications
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
