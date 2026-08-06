import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/lms_roles.dart';
import '../../features/auth/domain/auth_user.dart';
import '../../features/auth/providers/auth_controller.dart';
import '../../features/auth/presentation/account_state_screens.dart';
import '../../features/auth/presentation/auth_flow_screens.dart';
import '../../features/dashboard/presentation/home_shell_screen.dart';
import '../../features/field_training/presentation/assessment_attempt_screen.dart';
import '../../features/field_training/presentation/assessment_overview_screen.dart';
import '../../features/field_training/presentation/assessment_result_screen.dart';
import '../../features/field_training/presentation/assessments_hub_screen.dart';
import '../../features/certificates/presentation/certificate_detail_screen.dart';
import '../../features/certificates/presentation/certificates_hub_screen.dart';
import '../../features/profile/presentation/settings_screen.dart';
import '../../features/field_training/presentation/field_training_detail_screen.dart';
import '../../features/field_training/presentation/session_detail_screen.dart';
import '../../features/field_training/presentation/sessions_list_screen.dart';
import '../../features/field_training/presentation/task_detail_screen.dart';
import '../../features/courses/presentation/student_course_detail_screen.dart';
import '../../features/courses/presentation/student_courses_list_screen.dart';
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/notifications/presentation/notifications_inbox_screen.dart';
import '../../features/instructor/presentation/instructor_assessments_screen.dart';
import '../../features/instructor/presentation/instructor_attendance_screen.dart';
import '../../features/instructor/presentation/instructor_participant_detail_screen.dart';
import '../../features/instructor/presentation/instructor_participants_screen.dart';
import '../../features/instructor/presentation/instructor_sessions_screen.dart';
import '../../features/instructor/presentation/instructor_submissions_screen.dart';
import '../../features/instructor/presentation/instructor_training_detail_screen.dart';
import '../../features/instructor/presentation/instructor_trainings_screen.dart';
import '../../features/admin/presentation/admin_applications_screen.dart';
import '../../features/admin/presentation/admin_assessments_screen.dart';
import '../../features/admin/presentation/admin_opportunity_detail_screen.dart';
import '../../features/admin/presentation/admin_opportunity_form_screen.dart';
import '../../features/admin/presentation/admin_sessions_screen.dart';
import '../../features/admin/presentation/admin_student_detail_screen.dart';
import '../../features/admin/presentation/admin_submissions_screen.dart';
import '../../features/reviewer/presentation/qa_case_detail_screen.dart';
import '../../features/reviewer/presentation/qa_evidence_screen.dart';
import '../../features/reviewer/presentation/qa_review_detail_screen.dart';
import '../../features/reviewer/presentation/qa_reviews_hub_screen.dart';
import '../../features/reviewer/presentation/recognition_detail_screen.dart';
import '../../features/reviewer/presentation/reviewer_reports_screen.dart';
import '../../features/reviewer/presentation/reviewer_student_detail_screen.dart';
import '../../features/reviewer/presentation/reviewer_students_hub_screen.dart';
import '../../features/reviewer/presentation/widgets/pending_enrollments_section.dart';
import '../../features/reviewer/presentation/widgets/recognition_requests_section.dart';
import '../../features/super_admin/presentation/super_admin_audit_screen.dart';
import '../../features/super_admin/presentation/super_admin_certificates_screen.dart';
import '../../features/super_admin/presentation/super_admin_field_training_hub_screen.dart';
import '../../features/super_admin/presentation/super_admin_qa_oversight_screen.dart';
import '../../features/super_admin/presentation/super_admin_system_status_screen.dart';
import '../../features/super_admin/presentation/super_admin_university_detail_screen.dart';
import '../../features/super_admin/presentation/super_admin_university_form_screen.dart';
import '../../features/super_admin/presentation/super_admin_user_detail_screen.dart';
import '../../features/super_admin/presentation/super_admin_users_screen.dart';
import '../localization/l10n/app_localizations.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Do NOT watch auth state here — that recreates GoRouter on every
  // isLoading/status tick and remounts SplashScreen in a bootstrap loop.
  final refresh = _AuthRefreshListenable(ref);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final authState = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final status = authState.status;
      final isAuthRoute = location.startsWith('/auth');
      final isSplash = location == '/splash';

      if (status == AuthStatus.unknown) {
        return isSplash ? null : '/splash';
      }
      if (status == AuthStatus.authenticated) {
        if (isAuthRoute || isSplash) return '/home';
        // Student LMS courses are student-only.
        if (location.startsWith('/student/courses')) {
          final role = authState.user?.primaryRole;
          if (role != LmsRoles.student) return '/home';
        }
        return null;
      }
      if (status == AuthStatus.pendingApproval) {
        return location == '/auth/pending' ? null : '/auth/pending';
      }
      if (status == AuthStatus.inactive) {
        return location == '/auth/inactive' ? null : '/auth/inactive';
      }
      if (status == AuthStatus.unsupportedRole) {
        return location == '/auth/unsupported' ? null : '/auth/unsupported';
      }
      if (!isAuthRoute && !isSplash) return '/auth/login';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/auth/register',
        builder: (_, __) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/auth/verify-email',
        builder: (_, state) =>
            VerifyEmailScreen(email: state.uri.queryParameters['email'] ?? ''),
      ),
      GoRoute(
        path: '/auth/forgot-password',
        builder: (_, __) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/auth/reset-verify',
        builder: (_, state) =>
            ResetVerifyScreen(email: state.uri.queryParameters['email'] ?? ''),
      ),
      GoRoute(
        path: '/auth/new-password',
        builder: (_, state) => NewPasswordScreen(
          email: state.uri.queryParameters['email'] ?? '',
          resetToken: state.uri.queryParameters['token'] ?? '',
        ),
      ),
      GoRoute(
        path: '/auth/pending',
        builder: (_, __) => const PendingApprovalScreen(),
      ),
      GoRoute(
        path: '/auth/inactive',
        builder: (_, __) => const InactiveAccountScreen(),
      ),
      GoRoute(
        path: '/auth/unsupported',
        builder: (_, __) => const UnsupportedRoleScreen(),
      ),
      GoRoute(
        path: '/auth/network-error',
        builder: (_, __) => const NetworkErrorScreen(),
      ),
      GoRoute(path: '/home', builder: (_, __) => const HomeShellScreen()),
      GoRoute(
        path: '/student/field-training/:id/assessments/:type/attempt',
        builder: (_, state) => AssessmentAttemptScreen(
          opportunityId: state.pathParameters['id']!,
          type: state.pathParameters['type']!,
        ),
      ),
      GoRoute(
        path: '/student/field-training/:id/assessments/:type/result',
        builder: (_, state) => AssessmentResultScreen(
          opportunityId: state.pathParameters['id']!,
          type: state.pathParameters['type']!,
          initialAttempt: state.extra is Map<String, dynamic>
              ? state.extra! as Map<String, dynamic>
              : null,
        ),
      ),
      GoRoute(
        path: '/student/field-training/:id/assessments/:type',
        builder: (_, state) => AssessmentOverviewScreen(
          opportunityId: state.pathParameters['id']!,
          type: state.pathParameters['type']!,
        ),
      ),
      GoRoute(
        path: '/student/field-training/:id/assessments',
        builder: (_, state) => AssessmentsHubScreen(
          opportunityId: state.pathParameters['id']!,
          opportunityTitle: state.uri.queryParameters['title'],
          requiresPre: state.uri.queryParameters['requiresPre'] != 'false',
          requiresPost: state.uri.queryParameters['requiresPost'] != 'false',
        ),
      ),
      GoRoute(
        path: '/student/field-training/:id/sessions/:sessionId',
        builder: (_, state) => SessionDetailScreen(
          opportunityId: state.pathParameters['id']!,
          sessionId: state.pathParameters['sessionId']!,
          initialSession: state.extra is Map<String, dynamic>
              ? state.extra! as Map<String, dynamic>
              : null,
        ),
      ),
      GoRoute(
        path: '/student/field-training/:id/sessions',
        builder: (_, state) =>
            SessionsListScreen(opportunityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/student/field-training/:id',
        builder: (_, state) => FieldTrainingDetailScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/student/tasks/:taskId',
        builder: (_, state) => TaskDetailScreen(
          taskId: state.pathParameters['taskId']!,
          opportunityId: state.uri.queryParameters['opportunityId'] ?? '',
          initialTask: state.extra is Map<String, dynamic>
              ? state.extra! as Map<String, dynamic>
              : null,
        ),
      ),
      GoRoute(
        path: '/student/certificates',
        builder: (_, __) => const CertificatesHubScreen(),
      ),
      GoRoute(
        path: '/student/certificates/:id',
        builder: (_, state) =>
            CertificateDetailScreen(certificateId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/student/courses',
        builder: (_, __) =>
            const Scaffold(body: SafeArea(child: StudentCoursesListScreen())),
      ),
      GoRoute(
        path: '/student/courses/:id',
        builder: (_, state) =>
            StudentCourseDetailScreen(courseId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/student/courses/:id/lessons/:lessonId',
        builder: (_, state) => StudentCourseLessonScreen(
          courseId: state.pathParameters['id']!,
          lessonId: state.pathParameters['lessonId']!,
        ),
      ),
      GoRoute(
        path: '/student/settings',
        builder: (_, __) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsInboxScreen(),
      ),
      GoRoute(
        path: '/instructor/settings',
        builder: (_, __) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/instructor/field-training',
        builder: (_, __) => Scaffold(
          backgroundColor: const Color(0xFFF2F3F5),
          appBar: AppBar(
            title: Builder(
              builder: (context) =>
                  Text(AppLocalizations.of(context).myTrainings),
            ),
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
          ),
          body: const SafeArea(child: InstructorTrainingsScreen()),
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/participants/:applicationId',
        builder: (_, state) => InstructorParticipantDetailScreen(
          opportunityId: state.pathParameters['id']!,
          applicationId: state.pathParameters['applicationId']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/participants',
        builder: (_, state) => InstructorParticipantsScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/sessions/:sessionId/attendance',
        builder: (_, state) => InstructorAttendanceScreen(
          opportunityId: state.pathParameters['id']!,
          sessionId: state.pathParameters['sessionId']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/sessions',
        builder: (_, state) => InstructorSessionsScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/submissions/:submissionId',
        builder: (_, state) => InstructorSubmissionReviewScreen(
          opportunityId: state.pathParameters['id']!,
          submissionId: state.pathParameters['submissionId']!,
          initial: state.extra is Map<String, dynamic>
              ? state.extra! as Map<String, dynamic>
              : null,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/submissions',
        builder: (_, state) => InstructorSubmissionsScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id/assessments',
        builder: (_, state) => InstructorAssessmentsScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/instructor/field-training/:id',
        builder: (_, state) => InstructorTrainingDetailScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/admin/settings',
        builder: (_, __) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/admin/field-training/new',
        builder: (_, __) => const AdminOpportunityFormScreen(),
      ),
      GoRoute(
        path: '/admin/field-training/:id/edit',
        builder: (_, state) => AdminOpportunityFormScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/admin/field-training/:id/applications',
        builder: (_, state) =>
            AdminApplicationsScreen(opportunityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/field-training/:id/sessions',
        builder: (_, state) =>
            AdminSessionsScreen(opportunityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/field-training/:id/submissions',
        builder: (_, state) =>
            AdminSubmissionsScreen(opportunityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/field-training/:id/assessments',
        builder: (_, state) =>
            AdminAssessmentsScreen(opportunityId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/admin/field-training/:id',
        builder: (_, state) => AdminOpportunityDetailScreen(
          opportunityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/admin/applications/:applicationId',
        builder: (_, state) => AdminStudentDetailScreen(
          applicationId: state.pathParameters['applicationId']!,
        ),
      ),
      GoRoute(
        path: '/admin/reports/students/:applicationId',
        builder: (_, state) => AdminStudentDetailScreen(
          applicationId: state.pathParameters['applicationId']!,
        ),
      ),
      GoRoute(
        path: '/qa/reviews',
        builder: (_, __) =>
            const Scaffold(body: SafeArea(child: QaReviewsHubScreen())),
      ),
      GoRoute(
        path: '/qa/reviews/:id',
        builder: (_, state) =>
            QaReviewDetailScreen(reviewId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/qa/corrective/:id',
        builder: (_, state) => QaCaseDetailScreen(
          kind: QaCaseKind.corrective,
          id: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/qa/risk/:id',
        builder: (_, state) => QaCaseDetailScreen(
          kind: QaCaseKind.risk,
          id: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/qa/integrity/:id',
        builder: (_, state) => QaCaseDetailScreen(
          kind: QaCaseKind.integrity,
          id: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/reviewer/evidence',
        builder: (_, __) => const QaEvidenceScreen(),
      ),
      GoRoute(
        path: '/reviewer/recognition',
        builder: (_, __) => _WithUser(
          builder: (user) => Scaffold(
            appBar: AppBar(
              title: Builder(
                builder: (context) =>
                    Text(AppLocalizations.of(context).recognitionRequestsTitle),
              ),
            ),
            body: RecognitionRequestsSection(user: user),
          ),
        ),
      ),
      GoRoute(
        path: '/reviewer/recognition/:id',
        builder: (_, state) =>
            RecognitionDetailScreen(requestId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/reviewer/enrollments',
        builder: (_, __) => _WithUser(
          builder: (user) => Scaffold(
            appBar: AppBar(
              title: Builder(
                builder: (context) =>
                    Text(AppLocalizations.of(context).pendingEnrollmentsTitle),
              ),
            ),
            body: PendingEnrollmentsSection(user: user),
          ),
        ),
      ),
      GoRoute(
        path: '/reviewer/reports',
        builder: (_, __) => _WithUser(
          builder: (user) => Scaffold(
            appBar: AppBar(
              title: Builder(
                builder: (context) =>
                    Text(AppLocalizations.of(context).reports),
              ),
            ),
            body: ReviewerReportsScreen(user: user),
          ),
        ),
      ),
      GoRoute(
        path: '/reviewer/students',
        builder: (_, __) => _WithUser(
          builder: (user) => Scaffold(
            appBar: AppBar(
              title: Builder(
                builder: (context) =>
                    Text(AppLocalizations.of(context).trainees),
              ),
            ),
            body: ReviewerStudentsHubScreen(user: user),
          ),
        ),
      ),
      GoRoute(
        path: '/reviewer/students/:applicationId',
        builder: (_, state) => ReviewerStudentDetailScreen(
          applicationId: state.pathParameters['applicationId']!,
        ),
      ),
      GoRoute(
        path: '/reviewer/settings',
        builder: (_, __) => const SettingsScreen(),
      ),

      // —— super_admin (Phase 24) ——
      GoRoute(
        path: '/super/universities/new',
        builder: (_, __) => const SuperAdminUniversityFormScreen(),
      ),
      GoRoute(
        path: '/super/universities/:id/edit',
        builder: (_, state) => SuperAdminUniversityFormScreen(
          universityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/super/universities/:id/users',
        builder: (_, state) => Scaffold(
          appBar: AppBar(
            title: Builder(
              builder: (context) => Text(AppLocalizations.of(context).users),
            ),
          ),
          body: SafeArea(
            child: SuperAdminUsersScreen(
              initialUniversityId: state.pathParameters['id'],
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/super/universities/:id',
        builder: (_, state) => SuperAdminUniversityDetailScreen(
          universityId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/super/users/:id',
        builder: (_, state) =>
            SuperAdminUserDetailScreen(userId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/super/field-training',
        builder: (_, __) => const SuperAdminFieldTrainingHubScreen(),
      ),
      GoRoute(
        path: '/super/qa',
        builder: (_, __) => _WithUser(
          builder: (user) => SuperAdminQaOversightScreen(user: user),
        ),
      ),
      GoRoute(
        path: '/super/audit',
        builder: (_, __) => const SuperAdminAuditScreen(),
      ),
      GoRoute(
        path: '/super/system-status',
        builder: (_, __) => const SuperAdminSystemStatusScreen(),
      ),
      GoRoute(
        path: '/super/certificates',
        builder: (_, __) => const SuperAdminCertificatesScreen(),
      ),
      GoRoute(
        path: '/super/settings',
        builder: (_, __) => const SettingsScreen(),
      ),
    ],
  );
});

/// Reads the authenticated user before building a route that needs it
/// directly (rather than via each screen's own `ConsumerWidget`), matching
/// screens whose constructors require `AuthUser` (e.g. reviewer sections
/// shared between a shell tab and a standalone push route).
class _WithUser extends ConsumerWidget {
  const _WithUser({required this.builder});

  final Widget Function(AuthUser user) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return builder(user);
  }
}

class _AuthRefreshListenable extends ChangeNotifier {
  _AuthRefreshListenable(this.ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref ref;
}
