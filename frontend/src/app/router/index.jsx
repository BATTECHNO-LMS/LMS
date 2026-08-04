import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { InstructorLayout } from '../../layouts/InstructorLayout.jsx';
import { TrainerLayout } from '../../layouts/TrainerLayout.jsx';
import { TraineeLayout } from '../../layouts/TraineeLayout.jsx';
import { StudentLayout } from '../../layouts/StudentLayout.jsx';
import { ReviewerLayout } from '../../layouts/ReviewerLayout.jsx';
import { RouteFallback } from '../../components/common/RouteFallback.jsx';
import { LoginPage } from '../../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../../features/auth/pages/RegisterPage.jsx';
import { VerifyEmailOtpPage } from '../../pages/auth/VerifyEmailOtpPage.jsx';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage.jsx';
import { VerifyPasswordResetOtpPage } from '../../pages/auth/VerifyPasswordResetOtpPage.jsx';
import { NewPasswordPage } from '../../pages/auth/NewPasswordPage.jsx';
import { AccountStatusPage } from '../../pages/auth/AccountStatusPage.jsx';
import {
  AdminLoginPage,
  InstructorLoginPage,
  StudentLoginPage,
  ReviewerLoginPage,
} from '../../pages/auth/portalLogins.jsx';
import { PortalPickerPage } from '../../pages/auth/PortalPickerPage.jsx';
import {
  InstitutionLoginPage,
  UniversitiesLoginPage,
} from '../../pages/auth/InstitutionLoginPage.jsx';
import { InstitutionRegisterPage } from '../../pages/auth/InstitutionRegisterPage.jsx';
import { SelectOrganizationPage } from '../../pages/auth/SelectOrganizationPage.jsx';
import * as Pages from './lazyPages.js';
import { ProtectedRoute } from '../../components/common/ProtectedRoute.jsx';
import { RoleBasedRoute } from '../../components/common/RoleBasedRoute.jsx';
import { RootRedirect } from '../../components/common/RootRedirect.jsx';
import { RoleShellPermissionOutlet } from '../../components/permissions/RoleShellPermissionOutlet.jsx';
import { ADMIN_ROLE_SET, ROLES } from '../../constants/roles.js';
import { getCurrentPortalKey } from '../../utils/portal.js';

function SubdomainLoginRedirect() {
  const portal = getCurrentPortalKey();
  if (portal === 'admin') return <Navigate to="/login/admin" replace />;
  if (portal === 'instructor') return <Navigate to="/login/instructor" replace />;
  if (portal === 'student') return <Navigate to="/login/student" replace />;
  if (portal === 'reviewer') return <Navigate to="/login/reviewer" replace />;
  if (portal === 'institutions') return <Navigate to="/institutions/login" replace />;
  if (portal === 'universities') return <Navigate to="/universities/login" replace />;
  return <PortalPickerPage />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route path="/portals" element={<AuthLayout />}>
        <Route index element={<PortalPickerPage />} />
      </Route>

      <Route path="/login" element={<AuthLayout />}>
        <Route index element={<SubdomainLoginRedirect />} />
        <Route path="admin" element={<AdminLoginPage />} />
        <Route path="instructor" element={<InstructorLoginPage />} />
        <Route path="student" element={<StudentLoginPage />} />
        <Route path="reviewer" element={<ReviewerLoginPage />} />
      </Route>

      <Route path="/institutions" element={<AuthLayout />}>
        <Route path="login" element={<InstitutionLoginPage />} />
        <Route path="register" element={<InstitutionRegisterPage />} />
      </Route>

      <Route path="/universities" element={<AuthLayout />}>
        <Route path="login" element={<UniversitiesLoginPage />} />
      </Route>

      <Route path="/register" element={<AuthLayout />}>
        <Route index element={<RegisterPage />} />
      </Route>

      <Route path="/verify-email" element={<AuthLayout />}>
        <Route index element={<VerifyEmailOtpPage />} />
      </Route>

      <Route path="/forgot-password" element={<AuthLayout />}>
        <Route index element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/reset-password" element={<AuthLayout />}>
        <Route path="verify" element={<VerifyPasswordResetOtpPage />} />
        <Route path="new" element={<NewPasswordPage />} />
      </Route>

      <Route path="/account-status" element={<AuthLayout />}>
        <Route index element={<AccountStatusPage />} />
      </Route>

      <Route path="/select-organization" element={<AuthLayout />}>
        <Route index element={<SelectOrganizationPage />} />
      </Route>

      <Route path="/verify/certificate/:verificationCode" element={<Pages.CertificateVerifyPage />} />
      <Route path="/verify/report/:verificationCode" element={<Pages.ReportVerificationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={ADMIN_ROLE_SET} />}>
            <Route path="dashboard" element={<Pages.AdminDashboardPage />} />
            <Route path="analytics" element={<Pages.SuperAdminAnalyticsRoute />} />
            <Route path="courses" element={<Pages.SuperAdminCoursesRoute />} />
            <Route
              path="courses/:id/lessons"
              element={
                <Pages.SuperAdminCoursesRoute>
                  <Pages.AdminCourseLessonsPage />
                </Pages.SuperAdminCoursesRoute>
              }
            />
            <Route path="field-training" element={<Pages.SuperAdminFieldTrainingRoute />} />
            <Route path="help" element={<Navigate to="/admin/content-hub/help" replace />} />
            <Route path="content-hub/help" element={<Pages.HelpArticlesPage />} />
            <Route path="content-hub/help/create" element={<Pages.HelpArticleFormPage />} />
            <Route path="content-hub/help/:id/edit" element={<Pages.HelpArticleFormPage />} />
            <Route path="content-hub/tours" element={<Pages.ToursPage />} />
            <Route path="content-hub/popups" element={<Pages.PopupsPage />} />
            <Route path="content-hub/announcements" element={<Pages.AnnouncementsPage />} />
            <Route path="content-hub/notifications" element={<Pages.NotificationRulesPage />} />
            <Route path="content-hub/notifications/send" element={<Pages.NotificationSendPage />} />
            <Route path="content-hub/notifications/deliveries" element={<Pages.NotificationDeliveriesPage />} />
            <Route path="content-hub/notifications/analytics" element={<Pages.NotificationAnalyticsPage />} />
            <Route path="content-hub/contextual" element={<Pages.ContextualHelpAdminPage />} />
            <Route path="content-hub/analytics" element={<Pages.ContentAnalyticsPage />} />
            <Route path="content-hub/audit" element={<Pages.ContentAuditPage />} />
            <Route
              path="field-training/:id/applications"
              element={
                <Pages.SuperAdminFieldTrainingRoute>
                  <Pages.AdminFieldTrainingApplicationsPage />
                </Pages.SuperAdminFieldTrainingRoute>
              }
            />
            <Route
              path="field-training/:id/manage"
              element={
                <Pages.SuperAdminFieldTrainingRoute>
                  <Pages.AdminFieldTrainingManagePage />
                </Pages.SuperAdminFieldTrainingRoute>
              }
            />
            <Route
              path="field-training/:id/tasks"
              element={
                <Pages.SuperAdminFieldTrainingRoute>
                  <Pages.AdminFieldTrainingTasksPage />
                </Pages.SuperAdminFieldTrainingRoute>
              }
            />
            <Route path="field-training/reports" element={<Pages.AdminFieldTrainingReportsHubPage />} />
            <Route path="field-training/reports/global" element={<Pages.AdminFieldTrainingGlobalReportPage />} />
            <Route path="field-training/reports/university" element={<Pages.AdminFieldTrainingUniversityReportPage />} />
            <Route path="field-training/reports/students" element={<Pages.AdminFieldTrainingApplicationsReportPage />} />
            <Route
              path="field-training/reports/student/:applicationId"
              element={<Pages.AdminFieldTrainingStudentReportPage />}
            />
            <Route path="field-training-reports" element={<Navigate to="/admin/field-training/reports" replace />} />
            <Route path="field-training-reports/*" element={<Navigate to="/admin/field-training/reports" replace />} />
            <Route path="users/create" element={<Pages.UserCreatePage />} />
            <Route path="users/:id/edit" element={<Pages.UserEditPage />} />
            <Route path="users/:id" element={<Pages.UserViewPage />} />
            <Route path="users" element={<Pages.UsersListPage />} />
            <Route path="roles-permissions" element={<Pages.RolesPermissionsPage />} />
            <Route path="universities/create" element={<Pages.UniversityCreatePage />} />
            <Route path="universities/:id/edit" element={<Pages.UniversityEditPage />} />
            <Route path="universities/:id" element={<Pages.UniversityViewPage />} />
            <Route path="universities" element={<Pages.UniversitiesListPage />} />
            <Route path="institutions" element={<Pages.AdminInstitutionsPage />} />
            <Route path="institutions/:id" element={<Pages.AdminInstitutionDetailPage />} />
            <Route path="training-courses" element={<Pages.AdminTrainingCoursesPage />} />
            <Route path="training-courses/create" element={<Pages.AdminTrainingCourseCreatePage />} />
            <Route path="training-courses/:programId/edit" element={<Pages.AdminTrainingCourseEditPage />} />
            <Route path="training-courses/:programId" element={<Pages.AdminTrainingCourseDetailPage />} />
            <Route path="tracks/create" element={<Pages.TrackCreatePage />} />
            <Route path="tracks/:id/edit" element={<Pages.TrackEditPage />} />
            <Route path="tracks/:id" element={<Pages.TrackViewPage />} />
            <Route path="tracks" element={<Pages.TracksListPage />} />
            <Route path="micro-credentials/create" element={<Pages.MicroCredentialCreatePage />} />
            <Route path="micro-credentials/:id/edit" element={<Pages.MicroCredentialEditPage />} />
            <Route path="micro-credentials/:id" element={<Pages.MicroCredentialViewPage />} />
            <Route path="micro-credentials" element={<Pages.MicroCredentialsListPage />} />
            <Route path="learning-outcomes" element={<Pages.LearningOutcomesPage />} />
            <Route path="cohorts/create" element={<Pages.CohortCreatePage />} />
            <Route path="cohorts/:id/sessions/create" element={<Pages.SessionCreatePage />} />
            <Route path="cohorts/:id/sessions" element={<Pages.CohortSessionsListPage />} />
            <Route path="cohorts/:id/edit" element={<Pages.CohortEditPage />} />
            <Route path="cohorts/:id" element={<Pages.CohortViewPage />} />
            <Route path="cohorts" element={<Pages.CohortsListPage />} />
            <Route path="enrollments" element={<Pages.PendingEnrollmentsPage />} />
            <Route path="enrollments/:id" element={<Pages.EnrollmentViewPage />} />
            <Route path="sessions/:sessionId/attendance" element={<Pages.SessionAttendancePage />} />
            <Route path="sessions/:sessionId/edit" element={<Pages.SessionEditPage />} />
            <Route path="sessions/:sessionId" element={<Pages.SessionViewPage />} />
            <Route path="content" element={<Pages.ContentManagementPage />} />
            <Route path="sessions" element={<Pages.SessionsPage />} />
            <Route path="attendance" element={<Pages.AttendancePage />} />
            <Route path="assessments/create" element={<Pages.AssessmentCreatePage />} />
            <Route path="assessments/:id/edit" element={<Pages.AssessmentEditPage />} />
            <Route path="assessments/:id" element={<Pages.AssessmentViewPage />} />
            <Route path="assessments" element={<Pages.AssessmentsListPage />} />
            <Route path="rubrics/create" element={<Pages.RubricCreatePage />} />
            <Route path="rubrics/:id" element={<Pages.RubricDetailPage />} />
            <Route path="rubrics" element={<Pages.RubricsPage />} />
            <Route path="submissions" element={<Pages.SubmissionsPage />} />
            <Route path="grades" element={<Pages.GradesPage />} />
            <Route path="evidence" element={<Pages.EvidencePage />} />
            <Route path="qa" element={<Pages.QAPage />} />
            <Route path="qa-reviews" element={<Pages.QAReviewsPage />} />
            <Route path="corrective-actions" element={<Pages.CorrectiveActionsPage />} />
            <Route path="at-risk-students" element={<Pages.AtRiskStudentsPage />} />
            <Route path="risk-cases" element={<Pages.RiskCasesPage />} />
            <Route path="integrity-cases" element={<Pages.IntegrityCasesPage />} />
            <Route path="recognition-requests/create" element={<Pages.RecognitionRequestCreatePage />} />
            <Route path="recognition-requests/:id/edit" element={<Pages.RecognitionRequestEditPage />} />
            <Route path="recognition-requests/:id" element={<Pages.RecognitionRequestViewPage />} />
            <Route path="recognition-requests" element={<Pages.RecognitionRequestsListPage />} />
            <Route path="certificates/issue" element={<Pages.CertificateIssuePage />} />
            <Route path="certificates/:id" element={<Pages.CertificateDetailPage />} />
            <Route path="certificates" element={<Pages.CertificatesPage />} />
            <Route path="notifications" element={<Pages.NotificationsPage />} />
            <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
            <Route path="reports" element={<Pages.ReportsPage />} />
            <Route path="audit-logs/:id" element={<Pages.AuditLogDetailsPage />} />
            <Route path="audit-logs" element={<Pages.AuditLogsPage />} />
            <Route path="settings" element={<Pages.SettingsPage />} />
            <Route path="*" element={<Pages.ModulePlaceholderPage />} />
          </Route>
        </Route>

        <Route path="/trainer" element={<TrainerLayout />}>
          <Route index element={<Pages.TrainerDashboardPage />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.TRAINER]} />}>
            <Route path="courses" element={<Pages.TrainerCoursesPage />} />
            <Route path="courses/:programId" element={<Pages.TrainerCoursePage />} />
            <Route path="courses/:programId/:tab" element={<Pages.TrainerCoursePage />} />
            <Route path="notifications" element={<Pages.NotificationsPage />} />
            <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
            <Route path="user-guide" element={<Pages.StudentUserGuidePage />} />
            <Route path="user-guide/support" element={<Pages.StudentUserGuideSupportPage />} />
            <Route path="user-guide/articles/:slug" element={<Pages.StudentUserGuideArticlePage />} />
            <Route path="user-guide/:categorySlug" element={<Pages.StudentUserGuideCategoryPage />} />
            <Route path="profile" element={<Pages.TrainerProfilePage />} />
            <Route path="*" element={<Pages.ModulePlaceholderPage />} />
          </Route>
        </Route>

        <Route path="/trainee" element={<TraineeLayout />}>
          <Route index element={<Pages.TraineeDashboardPage />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.TRAINEE]} />}>
            <Route path="courses" element={<Pages.TraineeCoursesPage />} />
            <Route path="courses/:programId" element={<Pages.TraineeCourseDetailPage />} />
            <Route path="courses/:programId/:tab" element={<Pages.TraineeCourseDetailPage />} />
            <Route path="certificates" element={<Pages.CertificatePage />} />
            <Route path="notifications" element={<Pages.NotificationsPage />} />
            <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
            <Route path="user-guide" element={<Pages.StudentUserGuidePage />} />
            <Route path="user-guide/support" element={<Pages.StudentUserGuideSupportPage />} />
            <Route path="user-guide/articles/:slug" element={<Pages.StudentUserGuideArticlePage />} />
            <Route path="user-guide/:categorySlug" element={<Pages.StudentUserGuideCategoryPage />} />
            <Route path="profile" element={<Pages.TrainerProfilePage />} />
            <Route path="*" element={<Pages.ModulePlaceholderPage />} />
          </Route>
        </Route>

        <Route path="/instructor" element={<InstructorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.INSTRUCTOR]} />}>
            <Route path="at-risk-students" element={<Navigate to="/instructor/risk-students" replace />} />
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<Pages.InstructorDashboardPage />} />
              <Route path="cohorts/:id/sessions/create" element={<Pages.SessionCreatePage />} />
              <Route path="cohorts/:id/sessions" element={<Pages.CohortSessionsListPage />} />
              <Route path="cohorts/:id/edit" element={<Pages.CohortEditPage />} />
              <Route path="cohorts/:id" element={<Pages.CohortViewPage />} />
              <Route path="cohorts" element={<Pages.MyCohortsPage />} />
              <Route path="sessions/:sessionId/attendance" element={<Pages.SessionAttendancePage />} />
              <Route path="sessions/:sessionId/edit" element={<Pages.SessionEditPage />} />
              <Route path="sessions/:sessionId" element={<Pages.SessionViewPage />} />
              <Route path="enrollments/:id" element={<Pages.EnrollmentViewPage />} />
              <Route path="sessions" element={<Pages.InstructorSessionsPage />} />
              <Route path="attendance" element={<Pages.InstructorAttendancePage />} />
              <Route path="assessments/create" element={<Pages.InstructorAssessmentCreatePage />} />
              <Route path="assessments/:id/edit" element={<Pages.InstructorAssessmentEditPage />} />
              <Route path="assessments/:id" element={<Pages.AssessmentViewPage />} />
              <Route path="assessments" element={<Pages.InstructorAssessmentsPage />} />
              <Route path="submissions/:submissionId/grade" element={<Pages.InstructorAcademicGradePage />} />
              <Route path="submissions" element={<Pages.InstructorSubmissionsPage />} />
              <Route path="grades/:gradeId/edit" element={<Pages.InstructorAcademicGradePage />} />
              <Route path="grades" element={<Pages.InstructorGradesPage />} />
              <Route path="evidence/create" element={<Pages.EvidenceCreatePage />} />
              <Route path="evidence/:id/edit" element={<Pages.EvidenceEditPage />} />
              <Route path="evidence/:id" element={<Pages.EvidenceViewPage />} />
              <Route path="evidence" element={<Pages.InstructorEvidencePage />} />
              <Route path="risk-students" element={<Pages.RiskStudentsPage />} />
              <Route path="field-training" element={<Pages.InstructorFieldTrainingPage />} />
              <Route path="field-training/:id/manage" element={<Pages.InstructorFieldTrainingManagePage />} />
              <Route path="field-training/:id/participants" element={<Pages.InstructorFieldTrainingParticipantsPage />} />
              <Route path="field-training/:id/sessions" element={<Pages.InstructorFieldTrainingSessionsPage />} />
              <Route path="field-training/:id/attendance" element={<Pages.InstructorFieldTrainingAttendancePage />} />
              <Route path="field-training/:id/tasks" element={<Pages.InstructorFieldTrainingTasksPage />} />
              <Route path="field-training/:id/submissions" element={<Pages.InstructorFieldTrainingSubmissionsPage />} />
              <Route path="field-training/:id/results" element={<Pages.InstructorFieldTrainingResultsPage />} />
              <Route path="field-training/:id/eligibility" element={<Pages.InstructorFieldTrainingEligibilityPage />} />
              <Route path="user-guide" element={<Pages.StudentUserGuidePage />} />
              <Route path="user-guide/support" element={<Pages.StudentUserGuideSupportPage />} />
              <Route path="user-guide/articles/:slug" element={<Pages.StudentUserGuideArticlePage />} />
              <Route path="user-guide/:categorySlug" element={<Pages.StudentUserGuideCategoryPage />} />
              <Route path="notifications" element={<Pages.NotificationsPage />} />
              <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
              <Route path="*" element={<Pages.ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Pages.StudentEntryRedirect />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.STUDENT]} />}>
            <Route path="enrollments" element={<Navigate to="/student/programs" replace />} />
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<Pages.StudentDashboardPage />} />
              <Route path="courses" element={<Pages.StudentCoursesPage />} />
              <Route path="courses/:id" element={<Pages.StudentCourseDetailPage />} />
              <Route
                path="training-programs"
                element={
                  <Pages.TraineeTrainingProgramsRedirect
                    universityFallback={<Pages.StudentInstitutionProgramsPage />}
                  />
                }
              />
              <Route path="field-training" element={<Pages.StudentFieldTrainingPage />} />
              <Route path="user-guide" element={<Pages.StudentUserGuidePage />} />
              <Route path="user-guide/support" element={<Pages.StudentUserGuideSupportPage />} />
              <Route path="user-guide/articles/:slug" element={<Pages.StudentUserGuideArticlePage />} />
              <Route path="user-guide/:categorySlug" element={<Pages.StudentUserGuideCategoryPage />} />
              <Route
                path="field-training/:opportunityId/tasks/:taskId/self-evaluation"
                element={<Pages.StudentFieldTrainingSelfEvaluationPage />}
              />
              <Route
                path="field-training/:id/progress"
                element={<Pages.StudentFieldTrainingProgressRedirect />}
              />
              <Route path="field-training/:id" element={<Pages.StudentFieldTrainingDetailPage />} />
              <Route path="available-cohorts" element={<Pages.AvailableCohortsPage />} />
              <Route path="semester-schedule" element={<Pages.StudentSemesterSchedulePage />} />
              <Route path="programs/:id" element={<Pages.StudentProgramDetailPage />} />
              <Route path="programs" element={<Pages.MyProgramsPage />} />
              <Route path="content" element={<Pages.ContentPage />} />
              <Route path="sessions" element={<Pages.StudentSessionsPage />} />
              <Route path="attendance" element={<Pages.StudentAttendancePage />} />
              <Route path="assessments/:assessmentId/submit" element={<Pages.StudentAcademicSubmissionPage />} />
              <Route path="assessments" element={<Pages.StudentAssessmentsPage />} />
              <Route path="submissions" element={<Pages.StudentSubmissionsPage />} />
              <Route path="grades" element={<Pages.StudentGradesPage />} />
              <Route path="certificate" element={<Pages.CertificatePage />} />
              <Route path="notifications" element={<Pages.NotificationsPage />} />
              <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
              <Route path="*" element={<Pages.ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/academic" element={<AdminLayout />}>
          <Route index element={<Navigate to="field-training/reports" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.ADMIN, ROLES.REVIEWER]} />}>
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="field-training/reports" element={<Pages.AcademicFieldTrainingReportsHubPage />} />
              <Route path="field-training/reports/university" element={<Pages.AcademicFieldTrainingUniversityReportPage />} />
              <Route path="field-training/students" element={<Pages.AcademicFieldTrainingStudentsPage />} />
              <Route path="field-training/opportunities" element={<Pages.AcademicFieldTrainingOpportunitiesPage />} />
              <Route
                path="field-training/opportunities/:opportunityId"
                element={<Pages.AcademicFieldTrainingOpportunityDetailPage />}
              />
              <Route
                path="field-training/reports/student/:applicationId"
                element={<Pages.AcademicFieldTrainingStudentReportPage />}
              />
            </Route>
          </Route>
        </Route>

        <Route path="/reviewer" element={<ReviewerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.REVIEWER]} />}>
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<Pages.ReviewerDashboardPage />} />
              <Route path="enrollment-requests" element={<Pages.ReviewerEnrollmentRequestsPage />} />
              <Route path="recognition-requests/:id" element={<Pages.RecognitionRequestViewPage />} />
              <Route path="recognition-requests" element={<Pages.ReviewerRecognitionRequestsPage />} />
              <Route path="university-reports" element={<Pages.UniversityReportsPage />} />
              <Route path="field-training" element={<Navigate to="/academic/field-training/reports" replace />} />
              <Route path="field-training/*" element={<Navigate to="/academic/field-training/reports" replace />} />
              <Route path="evidence" element={<Pages.EvidenceViewerPage />} />
              <Route path="certificates/:id" element={<Pages.CertificateDetailPage />} />
              <Route path="certificates" element={<Pages.CertificatesReviewPage />} />
              <Route path="user-guide" element={<Pages.StudentUserGuidePage />} />
              <Route path="user-guide/support" element={<Pages.StudentUserGuideSupportPage />} />
              <Route path="user-guide/articles/:slug" element={<Pages.StudentUserGuideArticlePage />} />
              <Route path="user-guide/:categorySlug" element={<Pages.StudentUserGuideCategoryPage />} />
              <Route path="notifications" element={<Pages.NotificationsPage />} />
              <Route path="notification-settings" element={<Pages.NotificationPreferencesPage />} />
              <Route path="*" element={<Pages.ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
