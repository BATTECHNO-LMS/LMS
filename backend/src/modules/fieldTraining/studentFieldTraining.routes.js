const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles, requireOrganizationType } = require('../../middlewares/authorization.middleware');
const { validateRequest } = require('../../middlewares/validate.middleware');
const { env } = require('../../config/env');
const { getSecurityClientIp } = require('../../shared/security/clientIdentity');
const studentFieldTrainingController = require('./studentFieldTraining.controller');
const workflowController = require('./fieldTraining.workflow.controller');
const reportController = require('./fieldTrainingReport.controller');
const { applicationIdParamSchema: reportApplicationIdParamSchema } = require('./fieldTrainingReport.validation');
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
  taskSubmitFieldsSchema,
  confirmAttendanceWindowBodySchema,
  confirmQrAttendanceBodySchema,
  logbookEntryBodySchema,
  logbookEntryUpdateBodySchema,
  logbookEntryIdParamSchema,
  logbookAttachmentIdParamSchema,
  logbookListQuerySchema,
} = require('./fieldTraining.validation');
const { handleTaskUpload, handleLogbookUpload } = require('./fieldTraining.upload');
const logbookController = require('./fieldTraining.logbook.controller');
const { aiSelfEvalLimiter } = require('./fieldTraining.aiRateLimit.middleware');
const { attendanceConfirmLimiter } = require('./fieldTraining.attendanceRateLimit.middleware');
const attendanceWindowService = require('./fieldTraining.attendanceWindow.service');
const { success } = require('../../utils/apiResponse');
const evaluationRoutes = require('./fieldTrainingEvaluation.routes');

const router = express.Router();
router.use(authenticate);
router.use(requireOrganizationType('UNIVERSITY'));
const studentOnly = authorizeRoles(env.STUDENT_ROLE_CODE);
evaluationRoutes.mountStudentRoutes(router, studentOnly);
const recordedLectureRoutes = require('./fieldTraining.recordedLectures.routes');
recordedLectureRoutes.mountStudentRoutes(router, studentOnly);

router.get(
  '/my-applications',
  authenticate,
  studentOnly,
  studentFieldTrainingController.myApplications
);

router.get(
  '/applications/:applicationId/report',
  authenticate,
  studentOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.studentReport
);
router.get(
  '/applications/:applicationId/report/pdf',
  authenticate,
  studentOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.exportStudentPdf
);
router.get(
  '/applications/:applicationId/report/excel',
  authenticate,
  studentOnly,
  validateRequest({ params: reportApplicationIdParamSchema }),
  reportController.exportStudentExcel
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
  '/attendance-window/active',
  authenticate,
  studentOnly,
  async (req, res, next) => {
    try {
      const data = await attendanceWindowService.listActiveWindowsForStudent(req.user.userId);
      return success(res, data);
    } catch (e) {
      return next(e);
    }
  }
);

router.post(
  '/attendance-window/confirm',
  authenticate,
  studentOnly,
  attendanceConfirmLimiter,
  validateRequest({ body: confirmAttendanceWindowBodySchema }),
  async (req, res, next) => {
    try {
      const data = await attendanceWindowService.confirmAttendanceWithCode(
        req.validated.body,
        req.user,
        {
          ipAddress: getSecurityClientIp(req),
          deviceInfo: String(req.headers['user-agent'] || '').slice(0, 500) || null,
        }
      );
      return success(res, data, { message: data.message || 'Attendance confirmed' });
    } catch (e) {
      return next(e);
    }
  }
);

const qrAttendanceService = require('./fieldTraining.qrAttendance.service');

router.post(
  '/attendance/qr/confirm',
  authenticate,
  studentOnly,
  attendanceConfirmLimiter,
  validateRequest({ body: confirmQrAttendanceBodySchema }),
  async (req, res, next) => {
    try {
      const data = await qrAttendanceService.confirmAttendanceWithQr(
        req.validated.body,
        req.user,
        {
          ipAddress: getSecurityClientIp(req),
          deviceInfo: String(req.headers['user-agent'] || '').slice(0, 500) || null,
        }
      );
      return success(res, data, { message: data.message || 'تم تسجيل حضورك بنجاح' });
    } catch (e) {
      return next(e);
    }
  }
);

router.get(
  '/submissions/ai-supported-file-types',
  authenticate,
  studentOnly,
  studentFieldTrainingController.getAiSupportedFileTypes
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
  '/completion-letters/:applicationId/preview',
  authenticate,
  studentOnly,
  validateRequest({ params: applicationIdParamSchema }),
  workflowController.previewOwnCompletionLetter
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
  '/:id/logbook',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema, query: logbookListQuerySchema }),
  logbookController.studentList
);

router.post(
  '/:id/logbook',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema, body: logbookEntryBodySchema }),
  logbookController.studentCreate
);

router.patch(
  '/logbook/:entryId',
  authenticate,
  studentOnly,
  validateRequest({ params: logbookEntryIdParamSchema, body: logbookEntryUpdateBodySchema }),
  logbookController.studentUpdate
);

router.post(
  '/logbook/:entryId/submit',
  authenticate,
  studentOnly,
  validateRequest({ params: logbookEntryIdParamSchema }),
  logbookController.studentSubmit
);

router.delete(
  '/logbook/:entryId',
  authenticate,
  studentOnly,
  validateRequest({ params: logbookEntryIdParamSchema }),
  logbookController.studentDelete
);

router.post(
  '/logbook/:entryId/attachments',
  authenticate,
  studentOnly,
  validateRequest({ params: logbookEntryIdParamSchema }),
  handleLogbookUpload,
  logbookController.studentAddAttachment
);

router.get(
  '/logbook/attachments/:attachmentId/download',
  authenticate,
  studentOnly,
  validateRequest({ params: logbookAttachmentIdParamSchema }),
  logbookController.downloadAttachment
);

router.get(
  '/:id/portfolio',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  logbookController.getStudentPortfolioByOpportunity
);

router.get(
  '/:id/portfolio/pdf',
  authenticate,
  studentOnly,
  validateRequest({ params: uuidParamSchema }),
  logbookController.downloadPortfolioPdf
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
  '/:id/assessments/:type/save',
  authenticate,
  studentOnly,
  validateRequest({ params: assessmentTypeParamSchema, body: submitAssessmentBodySchema }),
  studentFieldTrainingController.saveAssessmentProgress
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
  // Params first so upload storage can use taskId; multer must run before body validation
  // because multipart fields are empty until the upload middleware parses the request.
  validateRequest({ params: taskIdParamSchema }),
  handleTaskUpload,
  validateRequest({ body: taskSubmitFieldsSchema }),
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
