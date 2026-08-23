import { lazy } from 'react';

/** @param {() => Promise<Record<string, unknown>>} loader @param {string} name */
function lazyNamed(loader, name) {
  return lazy(() => loader().then((mod) => ({ default: mod[name] })));
}

// —— Admin ——
export const AdminDashboardPage = lazyNamed(
  () => import('../../pages/admin/AdminDashboardPage.jsx'),
  'AdminDashboardPage'
);
export const UsersListPage = lazyNamed(() => import('../../pages/admin/users/UsersListPage.jsx'), 'UsersListPage');
export const UserCreatePage = lazyNamed(() => import('../../pages/admin/users/UserCreatePage.jsx'), 'UserCreatePage');
export const UserViewPage = lazyNamed(() => import('../../pages/admin/users/UserViewPage.jsx'), 'UserViewPage');
export const UserEditPage = lazyNamed(() => import('../../pages/admin/users/UserEditPage.jsx'), 'UserEditPage');
export const RolesPermissionsPage = lazyNamed(
  () => import('../../pages/admin/RolesPermissionsPage.jsx'),
  'RolesPermissionsPage'
);
export const UniversitiesListPage = lazyNamed(
  () => import('../../pages/admin/universities/UniversitiesListPage.jsx'),
  'UniversitiesListPage'
);
export const AdminInstitutionsPage = lazyNamed(
  () => import('../../pages/admin/institutions/AdminInstitutionsPage.jsx'),
  'AdminInstitutionsPage'
);
export const AdminInstitutionDetailPage = lazyNamed(
  () => import('../../pages/admin/institutions/AdminInstitutionDetailPage.jsx'),
  'AdminInstitutionDetailPage'
);
export const AdminTrainingCoursesPage = lazyNamed(
  () => import('../../pages/admin/trainingCourses/AdminTrainingCoursesPage.jsx'),
  'AdminTrainingCoursesPage'
);
export const AdminTrainingCourseCreatePage = lazyNamed(
  () => import('../../pages/admin/trainingCourses/AdminTrainingCourseCreatePage.jsx'),
  'AdminTrainingCourseCreatePage'
);
export const AdminTrainingCourseDetailPage = lazyNamed(
  () => import('../../pages/admin/trainingCourses/AdminTrainingCourseDetailPage.jsx'),
  'AdminTrainingCourseDetailPage'
);
export const AdminTrainingCourseEditPage = lazyNamed(
  () => import('../../pages/admin/trainingCourses/AdminTrainingCourseEditPage.jsx'),
  'AdminTrainingCourseEditPage'
);
export const RecordedLecturePlayerPage = lazyNamed(
  () => import('../../pages/shared/RecordedLecturePlayerPage.jsx'),
  'RecordedLecturePlayerPage'
);
export const StudentInstitutionProgramsPage = lazyNamed(
  () => import('../../pages/student/StudentInstitutionProgramsPage.jsx'),
  'StudentInstitutionProgramsPage'
);
export const UniversityCreatePage = lazyNamed(
  () => import('../../pages/admin/universities/UniversityCreatePage.jsx'),
  'UniversityCreatePage'
);
export const UniversityViewPage = lazyNamed(
  () => import('../../pages/admin/universities/UniversityViewPage.jsx'),
  'UniversityViewPage'
);
export const UniversityEditPage = lazyNamed(
  () => import('../../pages/admin/universities/UniversityEditPage.jsx'),
  'UniversityEditPage'
);
export const TracksListPage = lazyNamed(() => import('../../pages/admin/tracks/TracksListPage.jsx'), 'TracksListPage');
export const TrackCreatePage = lazyNamed(() => import('../../pages/admin/tracks/TrackCreatePage.jsx'), 'TrackCreatePage');
export const TrackViewPage = lazyNamed(() => import('../../pages/admin/tracks/TrackViewPage.jsx'), 'TrackViewPage');
export const TrackEditPage = lazyNamed(() => import('../../pages/admin/tracks/TrackEditPage.jsx'), 'TrackEditPage');
export const MicroCredentialsListPage = lazyNamed(
  () => import('../../pages/admin/micro-credentials/MicroCredentialsListPage.jsx'),
  'MicroCredentialsListPage'
);
export const MicroCredentialCreatePage = lazyNamed(
  () => import('../../pages/admin/micro-credentials/MicroCredentialCreatePage.jsx'),
  'MicroCredentialCreatePage'
);
export const MicroCredentialViewPage = lazyNamed(
  () => import('../../pages/admin/micro-credentials/MicroCredentialViewPage.jsx'),
  'MicroCredentialViewPage'
);
export const MicroCredentialEditPage = lazyNamed(
  () => import('../../pages/admin/micro-credentials/MicroCredentialEditPage.jsx'),
  'MicroCredentialEditPage'
);
export const LearningOutcomesPage = lazyNamed(
  () => import('../../pages/admin/LearningOutcomesPage.jsx'),
  'LearningOutcomesPage'
);
export const CohortsListPage = lazyNamed(() => import('../../pages/admin/cohorts/CohortsListPage.jsx'), 'CohortsListPage');
export const CohortCreatePage = lazyNamed(() => import('../../pages/admin/cohorts/CohortCreatePage.jsx'), 'CohortCreatePage');
export const CohortViewPage = lazyNamed(() => import('../../pages/admin/cohorts/CohortViewPage.jsx'), 'CohortViewPage');
export const CohortEditPage = lazyNamed(() => import('../../pages/admin/cohorts/CohortEditPage.jsx'), 'CohortEditPage');
export const CohortSessionsListPage = lazyNamed(
  () => import('../../pages/admin/cohorts/CohortSessionsListPage.jsx'),
  'CohortSessionsListPage'
);
export const SessionCreatePage = lazyNamed(
  () => import('../../pages/admin/cohorts/SessionCreatePage.jsx'),
  'SessionCreatePage'
);
export const SessionViewPage = lazyNamed(() => import('../../pages/admin/sessions/SessionViewPage.jsx'), 'SessionViewPage');
export const SessionEditPage = lazyNamed(() => import('../../pages/admin/sessions/SessionEditPage.jsx'), 'SessionEditPage');
export const SessionAttendancePage = lazyNamed(
  () => import('../../pages/admin/sessions/SessionAttendancePage.jsx'),
  'SessionAttendancePage'
);
export const EnrollmentViewPage = lazyNamed(
  () => import('../../pages/admin/enrollments/EnrollmentViewPage.jsx'),
  'EnrollmentViewPage'
);
export const PendingEnrollmentsPage = lazyNamed(
  () => import('../../pages/admin/enrollments/PendingEnrollmentsPage.jsx'),
  'PendingEnrollmentsPage'
);
export const ContentManagementPage = lazyNamed(
  () => import('../../pages/admin/ContentManagementPage.jsx'),
  'ContentManagementPage'
);
export const SessionsPage = lazyNamed(() => import('../../pages/admin/SessionsPage.jsx'), 'SessionsPage');
export const AttendancePage = lazyNamed(() => import('../../pages/admin/AttendancePage.jsx'), 'AttendancePage');
export const AssessmentsListPage = lazyNamed(
  () => import('../../pages/admin/assessments/AssessmentsListPage.jsx'),
  'AssessmentsListPage'
);
export const AssessmentCreatePage = lazyNamed(
  () => import('../../pages/admin/assessments/AssessmentCreatePage.jsx'),
  'AssessmentCreatePage'
);
export const AssessmentViewPage = lazyNamed(
  () => import('../../pages/admin/assessments/AssessmentViewPage.jsx'),
  'AssessmentViewPage'
);
export const AssessmentEditPage = lazyNamed(
  () => import('../../pages/admin/assessments/AssessmentEditPage.jsx'),
  'AssessmentEditPage'
);
export const RubricsPage = lazyNamed(() => import('../../pages/admin/RubricsPage.jsx'), 'RubricsPage');
export const RubricCreatePage = lazyNamed(() => import('../../pages/admin/rubrics/RubricCreatePage.jsx'), 'RubricCreatePage');
export const RubricDetailPage = lazyNamed(() => import('../../pages/admin/rubrics/RubricDetailPage.jsx'), 'RubricDetailPage');
export const SubmissionsPage = lazyNamed(() => import('../../pages/admin/SubmissionsPage.jsx'), 'SubmissionsPage');
export const GradesPage = lazyNamed(() => import('../../pages/admin/GradesPage.jsx'), 'GradesPage');
export const CertificatesPage = lazyNamed(() => import('../../pages/admin/CertificatesPage.jsx'), 'CertificatesPage');
export const CertificateIssuePage = lazyNamed(
  () => import('../../pages/admin/certificates/CertificateIssuePage.jsx'),
  'CertificateIssuePage'
);
export const CertificateDetailPage = lazyNamed(
  () => import('../../pages/admin/certificates/CertificateDetailPage.jsx'),
  'CertificateDetailPage'
);
export const ReportsPage = lazyNamed(() => import('../../pages/admin/ReportsPage.jsx'), 'ReportsPage');
export const AuditLogsPage = lazyNamed(() => import('../../pages/admin/AuditLogsPage.jsx'), 'AuditLogsPage');
export const AuditLogDetailsPage = lazyNamed(
  () => import('../../pages/admin/AuditLogDetailsPage.jsx'),
  'AuditLogDetailsPage'
);
export const SettingsPage = lazyNamed(() => import('../../pages/admin/SettingsPage.jsx'), 'SettingsPage');
export const SuperAdminAnalyticsRoute = lazyNamed(
  () => import('../../pages/admin/SuperAdminAnalyticsRoute.jsx'),
  'SuperAdminAnalyticsRoute'
);
export const SuperAdminCoursesRoute = lazyNamed(
  () => import('../../pages/admin/courses/SuperAdminCoursesRoute.jsx'),
  'SuperAdminCoursesRoute'
);
export const AdminCourseLessonsPage = lazyNamed(
  () => import('../../pages/admin/courses/AdminCourseLessonsPage.jsx'),
  'AdminCourseLessonsPage'
);
export const SuperAdminFieldTrainingRoute = lazyNamed(
  () => import('../../pages/admin/fieldTraining/SuperAdminFieldTrainingRoute.jsx'),
  'SuperAdminFieldTrainingRoute'
);
export const AdminFieldTrainingApplicationsPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingApplicationsPage.jsx'),
  'AdminFieldTrainingApplicationsPage'
);
export const AdminFieldTrainingManagePage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingManagePage.jsx'),
  'AdminFieldTrainingManagePage'
);
export const AdminFieldTrainingTasksPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingTasksPage.jsx'),
  'AdminFieldTrainingTasksPage'
);
export const StudentFieldTrainingSelfEvaluationPage = lazyNamed(
  () => import('../../pages/student/StudentFieldTrainingSelfEvaluationPage.jsx'),
  'StudentFieldTrainingSelfEvaluationPage'
);

// —— Instructor ——
export const InstructorDashboardPage = lazyNamed(
  () => import('../../pages/instructor/InstructorDashboardPage.jsx'),
  'InstructorDashboardPage'
);
export const TrainerDashboardPage = lazyNamed(
  () => import('../../pages/trainer/TrainerDashboardPage.jsx'),
  'TrainerDashboardPage'
);
export const TrainerCoursesPage = lazyNamed(
  () => import('../../pages/trainer/TrainerCoursesPage.jsx'),
  'TrainerCoursesPage'
);
export const TrainerCoursePage = lazyNamed(
  () => import('../../pages/trainer/TrainerCoursePage.jsx'),
  'TrainerCoursePage'
);
export const TrainerCourseEditPage = lazyNamed(
  () => import('../../pages/trainer/TrainerCourseEditPage.jsx'),
  'TrainerCourseEditPage'
);
export const TrainerRecordedLecturePlayerPage = lazyNamed(
  () => import('../../pages/shared/RecordedLecturePlayerPage.jsx'),
  'RecordedLecturePlayerPage'
);
export const TrainerProfilePage = lazyNamed(
  () => import('../../pages/trainer/TrainerProfilePage.jsx'),
  'TrainerProfilePage'
);
export const TraineeProfilePage = lazyNamed(
  () => import('../../pages/trainee/TraineeProfilePage.jsx'),
  'TraineeProfilePage'
);
export const TraineeDashboardPage = lazyNamed(
  () => import('../../pages/trainee/TraineeDashboardPage.jsx'),
  'TraineeDashboardPage'
);
export const TraineeCoursesPage = lazyNamed(
  () => import('../../pages/trainee/TraineeCoursesPage.jsx'),
  'TraineeCoursesPage'
);
export const TraineeCourseDetailPage = lazyNamed(
  () => import('../../pages/trainee/TraineeCourseDetailPage.jsx'),
  'TraineeCourseDetailPage'
);
export const TraineeRecordedLecturePlayerPage = lazyNamed(
  () => import('../../pages/shared/RecordedLecturePlayerPage.jsx'),
  'RecordedLecturePlayerPage'
);
export const TraineeTrainingProgramsRedirect = lazyNamed(
  () => import('../../pages/trainee/TraineeTrainingProgramsRedirect.jsx'),
  'TraineeTrainingProgramsRedirect'
);
export const MyCohortsPage = lazyNamed(() => import('../../pages/instructor/MyCohortsPage.jsx'), 'MyCohortsPage');
export const InstructorSessionsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorSessionsPage.jsx'),
  'InstructorSessionsPage'
);
export const InstructorAttendancePage = lazyNamed(
  () => import('../../pages/instructor/InstructorAttendancePage.jsx'),
  'InstructorAttendancePage'
);
export const InstructorAssessmentsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorAssessmentsPage.jsx'),
  'InstructorAssessmentsPage'
);
export const InstructorSubmissionsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorSubmissionsPage.jsx'),
  'InstructorSubmissionsPage'
);
export const InstructorAcademicGradePage = lazyNamed(
  () => import('../../pages/instructor/InstructorAcademicGradePage.jsx'),
  'InstructorAcademicGradePage'
);
export const InstructorGradesPage = lazyNamed(
  () => import('../../pages/instructor/InstructorGradesPage.jsx'),
  'InstructorGradesPage'
);
export const InstructorAssessmentCreatePage = lazyNamed(
  () => import('../../pages/instructor/InstructorAssessmentCreatePage.jsx'),
  'InstructorAssessmentCreatePage'
);
export const InstructorAssessmentEditPage = lazyNamed(
  () => import('../../pages/instructor/InstructorAssessmentEditPage.jsx'),
  'InstructorAssessmentEditPage'
);
export const InstructorFieldTrainingPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingPage.jsx'),
  'InstructorFieldTrainingPage'
);
export const InstructorFieldTrainingTasksPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingTasksPage.jsx'),
  'InstructorFieldTrainingTasksPage'
);
export const InstructorFieldTrainingManagePage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingManagePage.jsx'),
  'InstructorFieldTrainingManagePage'
);
export const InstructorFieldTrainingParticipantsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingParticipantsPage.jsx'),
  'InstructorFieldTrainingParticipantsPage'
);
export const InstructorFieldTrainingSessionsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingDeepLinks.jsx'),
  'InstructorFieldTrainingSessionsPage'
);
export const InstructorFieldTrainingAttendancePage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingDeepLinks.jsx'),
  'InstructorFieldTrainingAttendancePage'
);
export const InstructorFieldTrainingSubmissionsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingDeepLinks.jsx'),
  'InstructorFieldTrainingSubmissionsPage'
);
export const InstructorFieldTrainingResultsPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingDeepLinks.jsx'),
  'InstructorFieldTrainingResultsPage'
);
export const InstructorFieldTrainingEligibilityPage = lazyNamed(
  () => import('../../pages/instructor/InstructorFieldTrainingDeepLinks.jsx'),
  'InstructorFieldTrainingEligibilityPage'
);

// —— Student ——
export const StudentDashboardPage = lazyNamed(
  () => import('../../pages/student/StudentDashboardPage.jsx'),
  'StudentDashboardPage'
);
export const StudentCoursesPage = lazyNamed(
  () => import('../../pages/student/StudentCoursesPage.jsx'),
  'StudentCoursesPage'
);
export const StudentCourseDetailPage = lazyNamed(
  () => import('../../pages/student/StudentCourseDetailPage.jsx'),
  'StudentCourseDetailPage'
);
export const StudentFieldTrainingPage = lazyNamed(
  () => import('../../pages/student/StudentFieldTrainingPage.jsx'),
  'StudentFieldTrainingPage'
);
export const StudentUserGuidePage = lazyNamed(
  () => import('../../pages/student/userGuide/StudentUserGuidePage.jsx'),
  'StudentUserGuidePage'
);
export const StudentUserGuideCategoryPage = lazyNamed(
  () => import('../../pages/student/userGuide/StudentUserGuideCategoryPage.jsx'),
  'StudentUserGuideCategoryPage'
);
export const StudentUserGuideArticlePage = lazyNamed(
  () => import('../../pages/student/userGuide/StudentUserGuideArticlePage.jsx'),
  'StudentUserGuideArticlePage'
);
export const StudentUserGuideSupportPage = lazyNamed(
  () => import('../../pages/student/userGuide/StudentUserGuideSupportPage.jsx'),
  'StudentUserGuideSupportPage'
);
export const HelpArticlesPage = lazyNamed(
  () => import('../../pages/admin/contentHub/HelpArticlesPage.jsx'),
  'HelpArticlesPage'
);
export const HelpArticleFormPage = lazyNamed(
  () => import('../../pages/admin/contentHub/HelpArticleFormPage.jsx'),
  'HelpArticleFormPage'
);
export const ToursPage = lazyNamed(
  () => import('../../pages/admin/contentHub/ToursPage.jsx'),
  'ToursPage'
);
export const PopupsPage = lazyNamed(
  () => import('../../pages/admin/contentHub/PopupsPage.jsx'),
  'PopupsPage'
);
export const AnnouncementsPage = lazyNamed(
  () => import('../../pages/admin/contentHub/AnnouncementsPage.jsx'),
  'AnnouncementsPage'
);
export const ContextualHelpAdminPage = lazyNamed(
  () => import('../../pages/admin/contentHub/ContextualHelpAdminPage.jsx'),
  'ContextualHelpAdminPage'
);
export const ContentAnalyticsPage = lazyNamed(
  () => import('../../pages/admin/contentHub/ContentAnalyticsPage.jsx'),
  'ContentAnalyticsPage'
);
export const ContentAuditPage = lazyNamed(
  () => import('../../pages/admin/contentHub/ContentAuditPage.jsx'),
  'ContentAuditPage'
);
export const NotificationRulesPage = lazyNamed(
  () => import('../../pages/admin/contentHub/NotificationRulesPage.jsx'),
  'NotificationRulesPage'
);
export const NotificationSendPage = lazyNamed(
  () => import('../../pages/admin/contentHub/NotificationRulesPage.jsx'),
  'NotificationSendPage'
);
export const NotificationDeliveriesPage = lazyNamed(
  () => import('../../pages/admin/contentHub/NotificationRulesPage.jsx'),
  'NotificationDeliveriesPage'
);
export const NotificationAnalyticsPage = lazyNamed(
  () => import('../../pages/admin/contentHub/NotificationRulesPage.jsx'),
  'NotificationAnalyticsPage'
);
export const NotificationPreferencesPage = lazyNamed(
  () => import('../../pages/common/NotificationPreferencesPage.jsx'),
  'NotificationPreferencesPage'
);
export const StudentFieldTrainingDetailPage = lazyNamed(
  () => import('../../pages/student/StudentFieldTrainingDetailPage.jsx'),
  'StudentFieldTrainingDetailPage'
);
export const StudentFieldTrainingProgressRedirect = lazyNamed(
  () => import('../../pages/student/StudentFieldTrainingProgressRedirect.jsx'),
  'StudentFieldTrainingProgressRedirect'
);
export const StudentEntryRedirect = lazyNamed(
  () => import('../../pages/student/StudentEntryRedirect.jsx'),
  'StudentEntryRedirect'
);
export const AvailableCohortsPage = lazyNamed(
  () => import('../../pages/student/AvailableCohortsPage.jsx'),
  'AvailableCohortsPage'
);
export const MyProgramsPage = lazyNamed(() => import('../../pages/student/MyProgramsPage.jsx'), 'MyProgramsPage');
export const StudentProgramDetailPage = lazyNamed(
  () => import('../../pages/student/StudentProgramDetailPage.jsx'),
  'StudentProgramDetailPage'
);
export const StudentSemesterSchedulePage = lazyNamed(
  () => import('../../pages/student/StudentSemesterSchedulePage.jsx'),
  'StudentSemesterSchedulePage'
);
export const ContentPage = lazyNamed(() => import('../../pages/student/ContentPage.jsx'), 'ContentPage');
export const StudentSessionsPage = lazyNamed(
  () => import('../../pages/student/StudentSessionsPage.jsx'),
  'StudentSessionsPage'
);
export const StudentAttendancePage = lazyNamed(
  () => import('../../pages/student/StudentAttendancePage.jsx'),
  'StudentAttendancePage'
);
export const StudentAssessmentsPage = lazyNamed(
  () => import('../../pages/student/StudentAssessmentsPage.jsx'),
  'StudentAssessmentsPage'
);
export const StudentAcademicSubmissionPage = lazyNamed(
  () => import('../../pages/student/StudentAcademicSubmissionPage.jsx'),
  'StudentAcademicSubmissionPage'
);
export const StudentSubmissionsPage = lazyNamed(
  () => import('../../pages/student/StudentSubmissionsPage.jsx'),
  'StudentSubmissionsPage'
);
export const StudentGradesPage = lazyNamed(() => import('../../pages/student/StudentGradesPage.jsx'), 'StudentGradesPage');
export const CertificatePage = lazyNamed(() => import('../../pages/student/CertificatePage.jsx'), 'CertificatePage');

// —— Reviewer ——
export const ReviewerDashboardPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerDashboardPage.jsx'),
  'ReviewerDashboardPage'
);
export const ReviewerEnrollmentRequestsPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerEnrollmentRequestsPage.jsx'),
  'ReviewerEnrollmentRequestsPage'
);
export const UniversityReportsPage = lazyNamed(
  () => import('../../pages/reviewer/UniversityReportsPage.jsx'),
  'UniversityReportsPage'
);
export const CertificatesReviewPage = lazyNamed(
  () => import('../../pages/reviewer/CertificatesReviewPage.jsx'),
  'CertificatesReviewPage'
);
export const ReviewerFieldTrainingHubPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerFieldTrainingHubPage.jsx'),
  'ReviewerFieldTrainingHubPage'
);
export const ReviewerFieldTrainingApplicationsPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerFieldTrainingApplicationsPage.jsx'),
  'ReviewerFieldTrainingApplicationsPage'
);
export const ReviewerFieldTrainingUniversityReportPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerFieldTrainingUniversityReportPage.jsx'),
  'ReviewerFieldTrainingUniversityReportPage'
);
export const ReviewerFieldTrainingStudentReportPage = lazyNamed(
  () => import('../../pages/reviewer/ReviewerFieldTrainingStudentReportPage.jsx'),
  'ReviewerFieldTrainingStudentReportPage'
);
export const AdminFieldTrainingGlobalReportPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingGlobalReportPage.jsx'),
  'AdminFieldTrainingGlobalReportPage'
);
export const AdminFieldTrainingReportsHubPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingReportsHubPage.jsx'),
  'AdminFieldTrainingReportsHubPage'
);
export const AcademicFieldTrainingReportsHubPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingReportsHubPage.jsx'),
  'AcademicFieldTrainingReportsHubPage'
);
export const AcademicFieldTrainingUniversityReportPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingUniversityReportPage.jsx'),
  'AcademicFieldTrainingUniversityReportPage'
);
export const AcademicFieldTrainingStudentsPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingStudentsPage.jsx'),
  'AcademicFieldTrainingStudentsPage'
);
export const AcademicFieldTrainingStudentReportPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingStudentReportPage.jsx'),
  'AcademicFieldTrainingStudentReportPage'
);
export const AcademicFieldTrainingOpportunitiesPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingOpportunitiesPage.jsx'),
  'AcademicFieldTrainingOpportunitiesPage'
);
export const AcademicFieldTrainingOpportunityDetailPage = lazyNamed(
  () => import('../../pages/academic/AcademicFieldTrainingOpportunityDetailPage.jsx'),
  'AcademicFieldTrainingOpportunityDetailPage'
);
export const AdminFieldTrainingApplicationsReportPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingApplicationsReportPage.jsx'),
  'AdminFieldTrainingApplicationsReportPage'
);
export const AdminFieldTrainingUniversityReportPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingUniversityReportPage.jsx'),
  'AdminFieldTrainingUniversityReportPage'
);
export const AdminFieldTrainingStudentReportPage = lazyNamed(
  () => import('../../pages/admin/fieldTraining/AdminFieldTrainingStudentReportPage.jsx'),
  'AdminFieldTrainingStudentReportPage'
);

// —— Shared / public ——
export const ModulePlaceholderPage = lazyNamed(
  () => import('../../pages/common/ModulePlaceholderPage.jsx'),
  'ModulePlaceholderPage'
);
export const NotFoundPage = lazyNamed(
  () => import('../../pages/common/ModulePlaceholderPage.jsx'),
  'NotFoundPage'
);
export const AdminNotFoundPage = lazyNamed(
  () => import('../../pages/common/ModulePlaceholderPage.jsx'),
  'AdminNotFoundPage'
);
export const NotificationsPage = lazyNamed(
  () => import('../../pages/common/NotificationsPage.jsx'),
  'NotificationsPage'
);
export const CertificateVerifyPage = lazyNamed(
  () => import('../../pages/public/CertificateVerifyPage.jsx'),
  'CertificateVerifyPage'
);
export const PrivacyPolicyPage = lazyNamed(
  () => import('../../pages/public/LegalPublicPages.jsx'),
  'PrivacyPolicyPage'
);
export const AccountDeletionPage = lazyNamed(
  () => import('../../pages/public/LegalPublicPages.jsx'),
  'AccountDeletionPage'
);
export const ReportVerificationPage = lazyNamed(
  () => import('../../pages/public/ReportVerificationPage.jsx'),
  'ReportVerificationPage'
);

// —— Layouts (keep auth layout eager in the router) ——
export const AdminLayout = lazyNamed(() => import('../../layouts/AdminLayout.jsx'), 'AdminLayout');
export const InstructorLayout = lazyNamed(
  () => import('../../layouts/InstructorLayout.jsx'),
  'InstructorLayout'
);
export const TrainerLayout = lazyNamed(() => import('../../layouts/TrainerLayout.jsx'), 'TrainerLayout');
export const TraineeLayout = lazyNamed(() => import('../../layouts/TraineeLayout.jsx'), 'TraineeLayout');
export const StudentLayout = lazyNamed(() => import('../../layouts/StudentLayout.jsx'), 'StudentLayout');
export const ReviewerLayout = lazyNamed(
  () => import('../../layouts/ReviewerLayout.jsx'),
  'ReviewerLayout'
);

// —— Auth pages ——
export const RegisterPage = lazyNamed(
  () => import('../../features/auth/pages/RegisterPage.jsx'),
  'RegisterPage'
);
export const VerifyEmailOtpPage = lazyNamed(
  () => import('../../pages/auth/VerifyEmailOtpPage.jsx'),
  'VerifyEmailOtpPage'
);
export const ForgotPasswordPage = lazyNamed(
  () => import('../../pages/auth/ForgotPasswordPage.jsx'),
  'ForgotPasswordPage'
);
export const VerifyPasswordResetOtpPage = lazyNamed(
  () => import('../../pages/auth/VerifyPasswordResetOtpPage.jsx'),
  'VerifyPasswordResetOtpPage'
);
export const NewPasswordPage = lazyNamed(
  () => import('../../pages/auth/NewPasswordPage.jsx'),
  'NewPasswordPage'
);
export const AccountStatusPage = lazyNamed(
  () => import('../../pages/auth/AccountStatusPage.jsx'),
  'AccountStatusPage'
);
export const AdminLoginPage = lazyNamed(
  () => import('../../pages/auth/portalLogins.jsx'),
  'AdminLoginPage'
);
export const InstructorLoginPage = lazyNamed(
  () => import('../../pages/auth/portalLogins.jsx'),
  'InstructorLoginPage'
);
export const StudentLoginPage = lazyNamed(
  () => import('../../pages/auth/portalLogins.jsx'),
  'StudentLoginPage'
);
export const ReviewerLoginPage = lazyNamed(
  () => import('../../pages/auth/portalLogins.jsx'),
  'ReviewerLoginPage'
);
export const PortalPickerPage = lazyNamed(
  () => import('../../pages/auth/PortalPickerPage.jsx'),
  'PortalPickerPage'
);
export const InstitutionLoginPage = lazyNamed(
  () => import('../../pages/auth/InstitutionLoginPage.jsx'),
  'InstitutionLoginPage'
);
export const UniversitiesLoginPage = lazyNamed(
  () => import('../../pages/auth/InstitutionLoginPage.jsx'),
  'UniversitiesLoginPage'
);
export const InstitutionRegisterPage = lazyNamed(
  () => import('../../pages/auth/InstitutionRegisterPage.jsx'),
  'InstitutionRegisterPage'
);
export const SelectOrganizationPage = lazyNamed(
  () => import('../../pages/auth/SelectOrganizationPage.jsx'),
  'SelectOrganizationPage'
);
