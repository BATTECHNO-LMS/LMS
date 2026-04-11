import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { AdminLayout } from '../../layouts/AdminLayout.jsx';
import { InstructorLayout } from '../../layouts/InstructorLayout.jsx';
import { StudentLayout } from '../../layouts/StudentLayout.jsx';
import { ReviewerLayout } from '../../layouts/ReviewerLayout.jsx';
import { LoginPage } from '../../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../../features/auth/pages/RegisterPage.jsx';
import {
  AdminLoginPage,
  InstructorLoginPage,
  StudentLoginPage,
  ReviewerLoginPage,
} from '../../pages/auth/portalLogins.jsx';
import { AdminDashboardPage } from '../../pages/admin/AdminDashboardPage.jsx';
import { UsersListPage } from '../../pages/admin/users/UsersListPage.jsx';
import { UserCreatePage } from '../../pages/admin/users/UserCreatePage.jsx';
import { UserViewPage } from '../../pages/admin/users/UserViewPage.jsx';
import { UserEditPage } from '../../pages/admin/users/UserEditPage.jsx';
import { RolesPermissionsPage } from '../../pages/admin/RolesPermissionsPage.jsx';
import { UniversitiesListPage } from '../../pages/admin/universities/UniversitiesListPage.jsx';
import { UniversityCreatePage } from '../../pages/admin/universities/UniversityCreatePage.jsx';
import { UniversityViewPage } from '../../pages/admin/universities/UniversityViewPage.jsx';
import { UniversityEditPage } from '../../pages/admin/universities/UniversityEditPage.jsx';
import { TracksListPage } from '../../pages/admin/tracks/TracksListPage.jsx';
import { TrackCreatePage } from '../../pages/admin/tracks/TrackCreatePage.jsx';
import { TrackViewPage } from '../../pages/admin/tracks/TrackViewPage.jsx';
import { TrackEditPage } from '../../pages/admin/tracks/TrackEditPage.jsx';
import { MicroCredentialsListPage } from '../../pages/admin/micro-credentials/MicroCredentialsListPage.jsx';
import { MicroCredentialCreatePage } from '../../pages/admin/micro-credentials/MicroCredentialCreatePage.jsx';
import { MicroCredentialViewPage } from '../../pages/admin/micro-credentials/MicroCredentialViewPage.jsx';
import { MicroCredentialEditPage } from '../../pages/admin/micro-credentials/MicroCredentialEditPage.jsx';
import { LearningOutcomesPage } from '../../pages/admin/LearningOutcomesPage.jsx';
import { CohortsListPage } from '../../pages/admin/cohorts/CohortsListPage.jsx';
import { CohortCreatePage } from '../../pages/admin/cohorts/CohortCreatePage.jsx';
import { CohortViewPage } from '../../pages/admin/cohorts/CohortViewPage.jsx';
import { CohortEditPage } from '../../pages/admin/cohorts/CohortEditPage.jsx';
import { ContentManagementPage } from '../../pages/admin/ContentManagementPage.jsx';
import { SessionsPage } from '../../pages/admin/SessionsPage.jsx';
import { AttendancePage } from '../../pages/admin/AttendancePage.jsx';
import { AssessmentsListPage } from '../../pages/admin/assessments/AssessmentsListPage.jsx';
import { AssessmentCreatePage } from '../../pages/admin/assessments/AssessmentCreatePage.jsx';
import { AssessmentViewPage } from '../../pages/admin/assessments/AssessmentViewPage.jsx';
import { AssessmentEditPage } from '../../pages/admin/assessments/AssessmentEditPage.jsx';
import { RubricsPage } from '../../pages/admin/RubricsPage.jsx';
import { SubmissionsPage } from '../../pages/admin/SubmissionsPage.jsx';
import { GradesPage } from '../../pages/admin/GradesPage.jsx';
import { EvidencePage } from '../../pages/admin/EvidencePage.jsx';
import { QAPage } from '../../pages/admin/QAPage.jsx';
import { QAReviewsPage } from '../../pages/admin/QAReviewsPage.jsx';
import { CorrectiveActionsPage } from '../../pages/admin/CorrectiveActionsPage.jsx';
import { AtRiskStudentsPage } from '../../pages/admin/AtRiskStudentsPage.jsx';
import { RiskCasesPage } from '../../pages/admin/RiskCasesPage.jsx';
import { IntegrityCasesPage } from '../../pages/admin/IntegrityCasesPage.jsx';
import { RecognitionRequestsListPage } from '../../pages/admin/recognition-requests/RecognitionRequestsListPage.jsx';
import { RecognitionRequestCreatePage } from '../../pages/admin/recognition-requests/RecognitionRequestCreatePage.jsx';
import { RecognitionRequestViewPage } from '../../pages/admin/recognition-requests/RecognitionRequestViewPage.jsx';
import { RecognitionRequestEditPage } from '../../pages/admin/recognition-requests/RecognitionRequestEditPage.jsx';
import { CertificatesPage } from '../../pages/admin/CertificatesPage.jsx';
import { ReportsPage } from '../../pages/admin/ReportsPage.jsx';
import { AuditLogsPage } from '../../pages/admin/AuditLogsPage.jsx';
import { SettingsPage } from '../../pages/admin/SettingsPage.jsx';
import { SuperAdminAnalyticsRoute } from '../../pages/admin/SuperAdminAnalyticsRoute.jsx';
import { InstructorDashboardPage } from '../../pages/instructor/InstructorDashboardPage.jsx';
import { MyCohortsPage } from '../../pages/instructor/MyCohortsPage.jsx';
import { InstructorSessionsPage } from '../../pages/instructor/InstructorSessionsPage.jsx';
import { InstructorAttendancePage } from '../../pages/instructor/InstructorAttendancePage.jsx';
import { InstructorAssessmentsPage } from '../../pages/instructor/InstructorAssessmentsPage.jsx';
import { InstructorSubmissionsPage } from '../../pages/instructor/InstructorSubmissionsPage.jsx';
import { InstructorGradesPage } from '../../pages/instructor/InstructorGradesPage.jsx';
import { InstructorEvidencePage } from '../../pages/instructor/InstructorEvidencePage.jsx';
import { RiskStudentsPage } from '../../pages/instructor/RiskStudentsPage.jsx';
import { InstructorAssessmentCreatePage } from '../../pages/instructor/InstructorAssessmentCreatePage.jsx';
import { InstructorAssessmentEditPage } from '../../pages/instructor/InstructorAssessmentEditPage.jsx';
import { StudentDashboardPage } from '../../pages/student/StudentDashboardPage.jsx';
import { MyProgramsPage } from '../../pages/student/MyProgramsPage.jsx';
import { ContentPage } from '../../pages/student/ContentPage.jsx';
import { StudentSessionsPage } from '../../pages/student/StudentSessionsPage.jsx';
import { StudentAttendancePage } from '../../pages/student/StudentAttendancePage.jsx';
import { StudentAssessmentsPage } from '../../pages/student/StudentAssessmentsPage.jsx';
import { StudentSubmissionsPage } from '../../pages/student/StudentSubmissionsPage.jsx';
import { StudentGradesPage } from '../../pages/student/StudentGradesPage.jsx';
import { CertificatePage } from '../../pages/student/CertificatePage.jsx';
import { ReviewerDashboardPage } from '../../pages/reviewer/ReviewerDashboardPage.jsx';
import { ReviewerRecognitionRequestsPage } from '../../pages/reviewer/ReviewerRecognitionRequestsPage.jsx';
import { UniversityReportsPage } from '../../pages/reviewer/UniversityReportsPage.jsx';
import { EvidenceViewerPage } from '../../pages/reviewer/EvidenceViewerPage.jsx';
import { CertificatesReviewPage } from '../../pages/reviewer/CertificatesReviewPage.jsx';
import { ModulePlaceholderPage } from '../../pages/common/ModulePlaceholderPage.jsx';
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
  return <LoginPage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route path="/login" element={<AuthLayout />}>
        <Route index element={<SubdomainLoginRedirect />} />
        <Route path="admin" element={<AdminLoginPage />} />
        <Route path="instructor" element={<InstructorLoginPage />} />
        <Route path="student" element={<StudentLoginPage />} />
        <Route path="reviewer" element={<ReviewerLoginPage />} />
      </Route>

      <Route path="/register" element={<AuthLayout />}>
        <Route index element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={ADMIN_ROLE_SET} />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="analytics" element={<SuperAdminAnalyticsRoute />} />
            <Route path="users/create" element={<UserCreatePage />} />
            <Route path="users/:id/edit" element={<UserEditPage />} />
            <Route path="users/:id" element={<UserViewPage />} />
            <Route path="users" element={<UsersListPage />} />
            <Route path="roles-permissions" element={<RolesPermissionsPage />} />
            <Route path="universities/create" element={<UniversityCreatePage />} />
            <Route path="universities/:id/edit" element={<UniversityEditPage />} />
            <Route path="universities/:id" element={<UniversityViewPage />} />
            <Route path="universities" element={<UniversitiesListPage />} />
            <Route path="tracks/create" element={<TrackCreatePage />} />
            <Route path="tracks/:id/edit" element={<TrackEditPage />} />
            <Route path="tracks/:id" element={<TrackViewPage />} />
            <Route path="tracks" element={<TracksListPage />} />
            <Route path="micro-credentials/create" element={<MicroCredentialCreatePage />} />
            <Route path="micro-credentials/:id/edit" element={<MicroCredentialEditPage />} />
            <Route path="micro-credentials/:id" element={<MicroCredentialViewPage />} />
            <Route path="micro-credentials" element={<MicroCredentialsListPage />} />
            <Route path="learning-outcomes" element={<LearningOutcomesPage />} />
            <Route path="cohorts/create" element={<CohortCreatePage />} />
            <Route path="cohorts/:id/edit" element={<CohortEditPage />} />
            <Route path="cohorts/:id" element={<CohortViewPage />} />
            <Route path="cohorts" element={<CohortsListPage />} />
            <Route path="content" element={<ContentManagementPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="assessments/create" element={<AssessmentCreatePage />} />
            <Route path="assessments/:id/edit" element={<AssessmentEditPage />} />
            <Route path="assessments/:id" element={<AssessmentViewPage />} />
            <Route path="assessments" element={<AssessmentsListPage />} />
            <Route path="rubrics" element={<RubricsPage />} />
            <Route path="submissions" element={<SubmissionsPage />} />
            <Route path="grades" element={<GradesPage />} />
            <Route path="evidence" element={<EvidencePage />} />
            <Route path="qa" element={<QAPage />} />
            <Route path="qa-reviews" element={<QAReviewsPage />} />
            <Route path="corrective-actions" element={<CorrectiveActionsPage />} />
            <Route path="at-risk-students" element={<AtRiskStudentsPage />} />
            <Route path="risk-cases" element={<RiskCasesPage />} />
            <Route path="integrity-cases" element={<IntegrityCasesPage />} />
            <Route path="recognition-requests/create" element={<RecognitionRequestCreatePage />} />
            <Route path="recognition-requests/:id/edit" element={<RecognitionRequestEditPage />} />
            <Route path="recognition-requests/:id" element={<RecognitionRequestViewPage />} />
            <Route path="recognition-requests" element={<RecognitionRequestsListPage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<ModulePlaceholderPage />} />
          </Route>
        </Route>

        <Route path="/instructor" element={<InstructorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.INSTRUCTOR]} />}>
            <Route path="at-risk-students" element={<Navigate to="/instructor/risk-students" replace />} />
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<InstructorDashboardPage />} />
              <Route path="cohorts" element={<MyCohortsPage />} />
              <Route path="sessions" element={<InstructorSessionsPage />} />
              <Route path="attendance" element={<InstructorAttendancePage />} />
              <Route path="assessments/create" element={<InstructorAssessmentCreatePage />} />
              <Route path="assessments/:id/edit" element={<InstructorAssessmentEditPage />} />
              <Route path="assessments" element={<InstructorAssessmentsPage />} />
              <Route path="submissions" element={<InstructorSubmissionsPage />} />
              <Route path="grades" element={<InstructorGradesPage />} />
              <Route path="evidence" element={<InstructorEvidencePage />} />
              <Route path="risk-students" element={<RiskStudentsPage />} />
              <Route path="*" element={<ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.STUDENT]} />}>
            <Route path="enrollments" element={<Navigate to="/student/programs" replace />} />
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="programs" element={<MyProgramsPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="sessions" element={<StudentSessionsPage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="assessments" element={<StudentAssessmentsPage />} />
              <Route path="submissions" element={<StudentSubmissionsPage />} />
              <Route path="grades" element={<StudentGradesPage />} />
              <Route path="certificate" element={<CertificatePage />} />
              <Route path="*" element={<ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/reviewer" element={<ReviewerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route element={<RoleBasedRoute allowedRoles={[ROLES.UNIVERSITY_REVIEWER]} />}>
            <Route element={<RoleShellPermissionOutlet />}>
              <Route path="dashboard" element={<ReviewerDashboardPage />} />
              <Route path="recognition-requests" element={<ReviewerRecognitionRequestsPage />} />
              <Route path="university-reports" element={<UniversityReportsPage />} />
              <Route path="evidence" element={<EvidenceViewerPage />} />
              <Route path="certificates" element={<CertificatesReviewPage />} />
              <Route path="*" element={<ModulePlaceholderPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
