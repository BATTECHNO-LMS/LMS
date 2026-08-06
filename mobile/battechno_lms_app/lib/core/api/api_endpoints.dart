import '../../app/config/app_config.dart';

/// REST paths aligned with `frontend/src/services/endpoints.js`.
class ApiEndpoints {
  ApiEndpoints(this.config);

  final AppConfig config;

  String get login => '${config.authRoot}/login';
  String get logout => '${config.authRoot}/logout';
  String get register => '${config.authRoot}/register';
  String get verifyEmailOtp => '${config.authRoot}/verify-email-otp';
  String get resendEmailOtp => '${config.authRoot}/resend-email-otp';
  String get forgotPassword => '${config.authRoot}/forgot-password';
  String get verifyPasswordResetOtp =>
      '${config.authRoot}/verify-password-reset-otp';
  String get resendPasswordResetOtp =>
      '${config.authRoot}/resend-password-reset-otp';
  String get resetPassword => '${config.authRoot}/reset-password';
  String get me => '${config.authRoot}/me';
  String get registerUniversities => '${config.authRoot}/register/universities';

  String registerUniversitySpecialties(String universityId) =>
      '${config.authRoot}/register/universities/$universityId/specialties';

  String get studentFieldTraining => '${config.apiRoot}/student/field-training';
  String get studentMyApplications =>
      '${config.apiRoot}/student/field-training/my-applications';
  String studentFieldTrainingProgress(String id) =>
      '${config.apiRoot}/student/field-training/$id/progress';
  String studentFieldTrainingTasks(String id) =>
      '${config.apiRoot}/student/field-training/$id/tasks';
  String studentFieldTrainingDetail(String id) =>
      '${config.apiRoot}/student/field-training/$id';
  String studentSubmitTask(String taskId) =>
      '${config.apiRoot}/student/field-training/tasks/$taskId/submit';
  String studentFieldTrainingAssessments(String id) =>
      '${config.apiRoot}/student/field-training/$id/assessments';
  String studentFieldTrainingAssessment(String id, String type) =>
      '${config.apiRoot}/student/field-training/$id/assessments/$type';
  String studentFieldTrainingAssessmentSubmit(String id, String type) =>
      '${config.apiRoot}/student/field-training/$id/assessments/$type/submit';
  String studentFieldTrainingSessions(String id) =>
      '${config.apiRoot}/student/field-training/$id/sessions';
  String get notifications => '${config.apiRoot}/notifications';
  String notificationRead(String id) =>
      '${config.apiRoot}/notifications/$id/read';
  String get notificationsReadAll => '${config.apiRoot}/notifications/read-all';

  // —— Student LMS courses (academic كورسات) ——
  String get studentCourses => '${config.apiRoot}/student/courses';
  String studentCourse(String id) => '${config.apiRoot}/student/courses/$id';
  String studentCourseStart(String id) =>
      '${config.apiRoot}/student/courses/$id/start';
  String studentCourseProgress(String id) =>
      '${config.apiRoot}/student/courses/$id/progress';
  String studentCourseLessonComplete(String courseId, String lessonId) =>
      '${config.apiRoot}/student/courses/$courseId/lessons/$lessonId/complete';
  String studentCourseLessonTraining(String courseId, String lessonId) =>
      '${config.apiRoot}/student/courses/$courseId/lessons/$lessonId/training';

  String get certificates => '${config.apiRoot}/certificates';
  String certificateDetail(String id) => '${config.apiRoot}/certificates/$id';
  String get certificateVerify => '${config.apiRoot}/certificates/verify';

  String studentApply(String opportunityId) =>
      '${config.apiRoot}/student/field-training/$opportunityId/apply';
  String studentCompletionLetterDownload(String applicationId) =>
      '${config.apiRoot}/student/field-training/completion-letters/$applicationId/download';

  String fileDownloadUrl(String fileId) =>
      '${config.apiRoot}/files/$fileId/download-url';

  // —— Instructor field training ——
  String get instructorFieldTraining =>
      '${config.apiRoot}/instructor/field-training';
  String get instructorFieldTrainingStats =>
      '${config.apiRoot}/instructor/field-training/stats';
  String instructorOpportunity(String id) =>
      '${config.apiRoot}/instructor/field-training/$id';
  String instructorApplications(String opportunityId) =>
      '${config.apiRoot}/instructor/field-training/$opportunityId/applications';
  String instructorApplicationProgress(String applicationId) =>
      '${config.apiRoot}/instructor/field-training/applications/$applicationId/progress';
  String instructorSessions(String opportunityId) =>
      '${config.apiRoot}/instructor/field-training/$opportunityId/sessions';
  String instructorSession(String sessionId) =>
      '${config.apiRoot}/instructor/field-training/sessions/$sessionId';
  String instructorSessionAttendance(String sessionId) =>
      '${config.apiRoot}/instructor/field-training/sessions/$sessionId/attendance';
  String instructorSessionParticipants(String sessionId) =>
      '${config.apiRoot}/instructor/field-training/sessions/$sessionId/participants';
  String instructorTasks(String opportunityId) =>
      '${config.apiRoot}/instructor/field-training/$opportunityId/tasks';
  String instructorSubmissions(String opportunityId) =>
      '${config.apiRoot}/instructor/field-training/$opportunityId/submissions';
  String instructorSubmissionReview(String submissionId) =>
      '${config.apiRoot}/instructor/field-training/submissions/$submissionId/review';
  String instructorSubmissionDownloadUrl(String submissionId) =>
      '${config.apiRoot}/instructor/field-training/submissions/$submissionId/download-url';
  String instructorSubmissionDownload(String submissionId) =>
      '${config.apiRoot}/instructor/field-training/submissions/$submissionId/download';
  String instructorAssessments(String opportunityId) =>
      '${config.apiRoot}/instructor/field-training/$opportunityId/assessments';
  String instructorApplicationHours(String applicationId) =>
      '${config.apiRoot}/instructor/field-training/applications/$applicationId/hours';

  // —— University/academic admin field training ——
  String get adminFieldTraining => '${config.apiRoot}/admin/field-training';
  String get adminFieldTrainingStats =>
      '${config.apiRoot}/admin/field-training/stats';
  String adminOpportunity(String id) =>
      '${config.apiRoot}/admin/field-training/$id';
  String adminOpportunityPublish(String id) =>
      '${config.apiRoot}/admin/field-training/$id/publish';
  String adminOpportunityArchive(String id) =>
      '${config.apiRoot}/admin/field-training/$id/archive';
  String adminApplications(String opportunityId) =>
      '${config.apiRoot}/admin/field-training/$opportunityId/applications';
  String adminApplicationStatus(String applicationId) =>
      '${config.apiRoot}/admin/field-training/applications/$applicationId/status';
  String adminApplicationProgress(String applicationId) =>
      '${config.apiRoot}/admin/field-training/applications/$applicationId/progress';
  String adminApplicationHours(String applicationId) =>
      '${config.apiRoot}/admin/field-training/applications/$applicationId/hours';
  String get adminInstructors =>
      '${config.apiRoot}/admin/field-training/instructors';
  String get adminEligibilityCatalog =>
      '${config.apiRoot}/admin/field-training/eligibility-catalog';
  String adminSessions(String opportunityId) =>
      '${config.apiRoot}/admin/field-training/$opportunityId/sessions';
  String adminSessionAttendance(String sessionId) =>
      '${config.apiRoot}/admin/field-training/sessions/$sessionId/attendance';
  String adminSubmissions(String opportunityId) =>
      '${config.apiRoot}/admin/field-training/$opportunityId/submissions';
  String adminAssessments(String opportunityId) =>
      '${config.apiRoot}/admin/field-training/$opportunityId/assessments';
  String get adminFieldTrainingReportsUniversity =>
      '${config.apiRoot}/admin/field-training/reports/university';
  String get adminFieldTrainingReportsStudents =>
      '${config.apiRoot}/admin/field-training/reports/students';
  String adminFieldTrainingReportStudent(String applicationId) =>
      '${config.apiRoot}/admin/field-training/reports/students/$applicationId';

  /// `university_admin` or `super_admin` (`ADMIN_READ` scope).
  String get adminDashboardStats => '${config.apiRoot}/dashboard/admin-stats';

  /// `university_admin` or `super_admin` (`ADMIN_READ` scope).
  String get adminUsers => '${config.apiRoot}/users';

  // —— super_admin (Phase 24, isGlobal-gated) ——

  /// List/create — `ADMIN_READ` (list) / `super_admin`-only (create).
  String get universities => '${config.apiRoot}/universities';
  String university(String id) => '${config.apiRoot}/universities/$id';

  /// `super_admin`/`university_admin` (`ADMIN_READ`) list; `super_admin`-only
  /// create (`USER_WRITE`).
  String get users => '${config.apiRoot}/users';
  String userDetail(String id) => '${config.apiRoot}/users/$id';
  String userStatus(String id) => '${config.apiRoot}/users/$id/status';
  String userActivate(String id) => '${config.apiRoot}/users/$id/activate';

  /// `super_admin,university_admin,academic_admin` (`AUDIT_LOG_READ`).
  String get auditLogs => '${config.apiRoot}/audit-logs';
  String auditLog(String id) => '${config.apiRoot}/audit-logs/$id';

  /// `super_admin`-only global field-training report.
  String get adminFieldTrainingReportsGlobal =>
      '${config.apiRoot}/admin/field-training/reports/global';

  // —— QA reviews / corrective actions / risk cases / integrity cases ——
  // (`qa_officer` only among Phase 23 roles; `RISK_INTEGRITY_ROLE_CODES` /
  // `QA_OVERSIGHT_ROLE_CODES` backend scopes).
  String get qaReviews => '${config.apiRoot}/qa-reviews';
  String qaReview(String id) => '${config.apiRoot}/qa-reviews/$id';
  String qaReviewStatus(String id) => '${config.apiRoot}/qa-reviews/$id/status';

  String get correctiveActions => '${config.apiRoot}/corrective-actions';
  String correctiveAction(String id) =>
      '${config.apiRoot}/corrective-actions/$id';
  String correctiveActionStatus(String id) =>
      '${config.apiRoot}/corrective-actions/$id/status';

  String get riskCases => '${config.apiRoot}/risk-cases';
  String riskCase(String id) => '${config.apiRoot}/risk-cases/$id';
  String riskCaseStatus(String id) => '${config.apiRoot}/risk-cases/$id/status';

  String get integrityCases => '${config.apiRoot}/integrity-cases';
  String integrityCase(String id) => '${config.apiRoot}/integrity-cases/$id';
  String integrityCaseStatus(String id) =>
      '${config.apiRoot}/integrity-cases/$id/status';

  // —— Evidence (read-only for `qa_officer` and `university_reviewer`) ——
  String get evidence => '${config.apiRoot}/evidence';
  String evidenceDetail(String id) => '${config.apiRoot}/evidence/$id';

  // —— Recognition requests (`university_reviewer` only) ——
  String get recognitionRequests => '${config.apiRoot}/recognition-requests';
  String recognitionRequest(String id) =>
      '${config.apiRoot}/recognition-requests/$id';
  String recognitionRequestDocuments(String id) =>
      '${config.apiRoot}/recognition-requests/$id/documents';
  String recognitionRequestStatus(String id) =>
      '${config.apiRoot}/recognition-requests/$id/status';

  // —— Enrollment decisions (`university_reviewer` only) ——
  String get enrollmentsPending => '${config.apiRoot}/enrollments/pending';
  String enrollmentApprove(String id) =>
      '${config.apiRoot}/enrollments/$id/approve';
  String enrollmentReject(String id) =>
      '${config.apiRoot}/enrollments/$id/reject';

  // —— Academic field-training reports/students (both reviewer roles) ——
  String get academicFieldTrainingReportsUniversity =>
      '${config.apiRoot}/academic/field-training/reports/university';
  String get academicFieldTrainingStudents =>
      '${config.apiRoot}/academic/field-training/students';
  String academicFieldTrainingReportStudent(String applicationId) =>
      '${config.apiRoot}/academic/field-training/reports/students/$applicationId';
  String academicTaskInstructionDownloadUrl(String taskId) =>
      '${config.apiRoot}/academic/field-training/tasks/$taskId/instruction-file/download-url';

  // —— Mobile push notifications (Phase 25) ——
  /// POST to register/refresh a device token; DELETE (with the same body)
  /// to unregister a single token.
  String get mobilePushRegister => '${config.apiRoot}/mobile/push/register';
  String get mobilePushRegisterAll =>
      '${config.apiRoot}/mobile/push/register-all';
}
