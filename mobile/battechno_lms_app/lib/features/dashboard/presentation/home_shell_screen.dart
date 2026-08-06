import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/auth/lms_roles.dart';
import '../../../core/push/push_config.dart';
import '../../../core/push/push_message.dart';
import '../../../core/push/push_providers.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/widgets/app_shell.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../../auth/providers/auth_controller.dart';
import '../../courses/presentation/student_courses_list_screen.dart';
import '../../notifications/data/notifications_repository.dart';
import '../../notifications/presentation/notifications_inbox_screen.dart';
import '../../profile/presentation/student_profile_screen.dart';
import '../../training/presentation/student_training_list_screen.dart';
import '../../instructor/presentation/instructor_home_screen.dart';
import '../../instructor/presentation/instructor_profile_screen.dart';
import '../../instructor/presentation/instructor_students_hub_screen.dart';
import '../../instructor/presentation/instructor_trainings_screen.dart';
import '../../admin/presentation/admin_home_screen.dart';
import '../../admin/presentation/admin_opportunities_screen.dart';
import '../../admin/presentation/admin_profile_screen.dart';
import '../../admin/presentation/admin_reports_screen.dart';
import '../../admin/presentation/admin_students_hub_screen.dart';
import '../../reviewer/presentation/qa_home_screen.dart';
import '../../reviewer/presentation/qa_reviews_hub_screen.dart';
import '../../reviewer/presentation/reviewer_home_screen.dart';
import '../../reviewer/presentation/reviewer_profile_screen.dart';
import '../../reviewer/presentation/reviewer_reports_screen.dart';
import '../../reviewer/presentation/reviewer_reviews_hub_screen.dart';
import '../../reviewer/presentation/reviewer_students_hub_screen.dart';
import '../../super_admin/domain/super_admin_models.dart';
import '../../super_admin/presentation/super_admin_home_screen.dart';
import '../../super_admin/presentation/super_admin_profile_screen.dart';
import '../../super_admin/presentation/super_admin_reports_screen.dart';
import '../../super_admin/presentation/super_admin_universities_screen.dart';
import '../../super_admin/presentation/super_admin_users_screen.dart';
import '../../push/data/push_token_sync_service.dart';
import '../../push/presentation/push_permission_sheet.dart';
import '../../push/providers/push_permission_controller.dart';
import '../../push/providers/push_route_coordinator.dart';
import '../data/student_dashboard_repository.dart';
import 'student_home_screen.dart';

final studentDashboardRepositoryProvider = Provider<StudentDashboardRepository>(
  (ref) => StudentDashboardRepository(ref.watch(apiClientProvider)),
);

/// Nested pages request a bottom-nav tab by writing an index here.
/// [HomeShellScreen] listens and applies it, then clears the request.
final shellTabIndexRequestProvider = StateProvider<int?>((ref) => null);

class HomeShellScreen extends ConsumerStatefulWidget {
  const HomeShellScreen({super.key});

  @override
  ConsumerState<HomeShellScreen> createState() => _HomeShellScreenState();
}

class _HomeShellScreenState extends ConsumerState<HomeShellScreen> {
  int _index = 0;
  StreamSubscription<PushMessage>? _pushForegroundSub;
  StreamSubscription<PushMessage>? _pushOpenedAppSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(notificationsControllerProvider.notifier).refresh();
      _checkSuperAdminPrivilege();
      _bootstrapPush();
    });
  }

  @override
  void dispose() {
    _pushForegroundSub?.cancel();
    _pushOpenedAppSub?.cancel();
    super.dispose();
  }

  /// Fires once per authenticated session (this screen only ever renders
  /// after auth resolves — never during splash). Every step below is a
  /// no-op when `PushConfig.isConfigured` is false, which is always the
  /// case in this repo (no Firebase config files shipped).
  Future<void> _bootstrapPush() async {
    if (!PushConfig.isConfigured) return;
    final gateway = ref.read(pushMessagingGatewayProvider);
    await gateway.initialize();

    _pushForegroundSub = gateway.onForegroundMessage.listen((message) {
      ref.read(notificationsControllerProvider.notifier).refresh();
      ref.read(localNotificationServiceProvider).showForegroundAlert(message);
    });
    _pushOpenedAppSub = gateway.onMessageOpenedApp.listen((message) {
      final route = ref
          .read(pushRouteCoordinatorProvider.notifier)
          .handleActionUrl(message.actionUrl);
      if (route != null && mounted) context.push(route);
    });

    final initialMessage = await gateway.getInitialMessage();
    if (initialMessage != null && mounted) {
      final route = ref
          .read(pushRouteCoordinatorProvider.notifier)
          .handleActionUrl(initialMessage.actionUrl);
      if (route != null) context.push(route);
    }

    final permissionController = ref.read(
      pushPermissionControllerProvider.notifier,
    );
    final hasPrompted = await permissionController.loadHasPrompted();
    await permissionController.refreshStatus();
    if (!mounted) return;
    final status = ref.read(pushPermissionControllerProvider).status;
    if (status == PushPermissionStatus.granted ||
        status == PushPermissionStatus.provisional) {
      await permissionController.requestAndSync();
      return;
    }
    if (hasPrompted || status == PushPermissionStatus.denied) return;
    if (!mounted) return;
    await showPushPermissionSheet(context, ref);
  }

  /// Lost-privilege handling: if the cached user claims `super_admin` but
  /// `isGlobal` is false (stale token / server-side revocation while the
  /// app was open), re-fetch `/auth/me` once. The backend is authoritative;
  /// this never grants access locally — it only refreshes state so a truly
  /// revoked user is redirected out of any stale super_admin UI.
  Future<void> _checkSuperAdminPrivilege() async {
    final user = ref.read(authControllerProvider).user;
    if (user == null || user.primaryRole != LmsRoles.superAdmin) return;
    if (SuperAdminCapabilities.canAccess(user)) return;
    await ref.read(authControllerProvider.notifier).refreshCurrentUser();
  }

  Future<void> _logout() async {
    final user = ref.read(authControllerProvider).user;
    // Best-effort — must never block sign-out, and must run before the
    // token is cleared/invalidated by `authController.logout()`.
    if (PushConfig.isConfigured) {
      await ref.read(pushTokenSyncServiceProvider).unregisterAllBestEffort();
    }
    ref.read(pushRouteCoordinatorProvider.notifier).clear();
    await ref.read(authControllerProvider.notifier).logout();
    final cache = await OfflineCache.open();
    if (user != null) {
      await cache.clearUser(user.id);
    } else {
      await cache.clearAll();
    }
    if (mounted) context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(authControllerProvider).user;
    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    // Fail-closed: `super_admin` role without a backend-verified `isGlobal`
    // gets no tabs at all — an empty shell with a lost-privilege message
    // and only a sign-out affordance. Never render nav items that imply
    // super_admin screens exist for this session.
    if (user.primaryRole == LmsRoles.superAdmin &&
        !SuperAdminCapabilities.canAccess(user)) {
      return Scaffold(
        appBar: BattechnoAppBar(title: l10n.unsupportedRoleTitle),
        body: SafeArea(
          child: PlaceholderShellPage(
            title: l10n.unsupportedRoleTitle,
            message: l10n.superAdminLostPrivilegeMessage,
            onLogout: _logout,
          ),
        ),
      );
    }

    final navItems = shellNavForRole(user.primaryRole, l10n);
    final pages = _pagesForRole(user, l10n);
    final notificationsState = ref.watch(notificationsControllerProvider);
    final unread =
        notificationsState.valueOrNull?.notifications
            .where((n) => !n.isRead)
            .length ??
        0;

    ref.listen<int?>(shellTabIndexRequestProvider, (previous, next) {
      if (next == null) return;
      final clamped = next.clamp(0, navItems.length - 1);
      if (clamped != _index) {
        setState(() => _index = clamped);
      }
      Future.microtask(() {
        if (ref.read(shellTabIndexRequestProvider) != null) {
          ref.read(shellTabIndexRequestProvider.notifier).state = null;
        }
      });
    });

    final isHomeTab = _index == 0;
    final isStudentProfileTab =
        user.primaryRole == LmsRoles.student && _index == 3;
    final isInstructorProfileTab =
        user.primaryRole == LmsRoles.instructor && _index == 3;
    final isAdminProfileTab =
        (user.primaryRole == LmsRoles.universityAdmin ||
            user.primaryRole == LmsRoles.academicAdmin) &&
        _index == 4;
    final isReviewerProfileTab =
        user.primaryRole == LmsRoles.universityReviewer && _index == 4;
    final isQaProfileTab =
        user.primaryRole == LmsRoles.qaOfficer && _index == 4;
    final isSuperAdminProfileTab =
        user.primaryRole == LmsRoles.superAdmin && _index == 4;
    final isImmersiveProfileTab =
        isStudentProfileTab ||
        isInstructorProfileTab ||
        isAdminProfileTab ||
        isReviewerProfileTab ||
        isQaProfileTab ||
        isSuperAdminProfileTab;

    final isQaNotificationsTab =
        user.primaryRole == LmsRoles.qaOfficer && _index == 3;

    return Scaffold(
      extendBody: true,
      backgroundColor: isImmersiveProfileTab ? BatColors.primary : null,
      appBar: (isHomeTab || isImmersiveProfileTab || isQaNotificationsTab)
          ? null
          : BattechnoAppBar(
              title: navItems[_index.clamp(0, navItems.length - 1)].label,
              onBack: () => setState(() => _index = 0),
              notificationsTooltip: l10n.notifications,
              unreadCount: unread,
              onNotifications: () {
                context.push('/notifications');
              },
            ),
      body: SafeArea(
        top: !isImmersiveProfileTab,
        bottom: false,
        child: pages[_index.clamp(0, pages.length - 1)],
      ),
      bottomNavigationBar: AppBottomNavigation(
        items: navItems,
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }

  List<Widget> _pagesForRole(AuthUser user, AppLocalizations l10n) {
    switch (user.primaryRole) {
      case LmsRoles.student:
        return [
          StudentHomeScreen(user: user),
          const StudentTrainingListScreen(),
          const StudentCoursesListScreen(),
          StudentProfileScreen(user: user, onLogout: _logout),
        ];
      case LmsRoles.instructor:
        return [
          InstructorHomeScreen(user: user),
          const InstructorTrainingsScreen(),
          const InstructorStudentsHubScreen(),
          InstructorProfileScreen(user: user, onLogout: _logout),
        ];
      case LmsRoles.universityAdmin:
      case LmsRoles.academicAdmin:
        return [
          AdminHomeScreen(user: user),
          const AdminOpportunitiesScreen(),
          const AdminStudentsHubScreen(),
          const AdminReportsScreen(),
          AdminProfileScreen(user: user, onLogout: _logout),
        ];
      case LmsRoles.qaOfficer:
        return [
          QaHomeScreen(user: user),
          const QaReviewsHubScreen(),
          ReviewerReportsScreen(user: user),
          const NotificationsInboxScreen(embeddedInShell: true),
          ReviewerProfileScreen(user: user, onLogout: _logout),
        ];
      case LmsRoles.universityReviewer:
        return [
          ReviewerHomeScreen(user: user),
          ReviewerReviewsHubScreen(user: user),
          ReviewerStudentsHubScreen(user: user),
          ReviewerReportsScreen(user: user),
          ReviewerProfileScreen(user: user, onLogout: _logout),
        ];
      case LmsRoles.superAdmin:
        // `build()` already fails closed to an empty shell when
        // `!SuperAdminCapabilities.canAccess(user)`, so reaching here means
        // the backend has verified both `role == super_admin` and
        // `isGlobal == true`.
        return [
          SuperAdminHomeScreen(user: user),
          const SuperAdminUniversitiesScreen(),
          const SuperAdminUsersScreen(),
          SuperAdminReportsScreen(user: user),
          SuperAdminProfileScreen(user: user, onLogout: _logout),
        ];
      default:
        return [
          PlaceholderShellPage(title: l10n.home),
          PlaceholderShellPage(title: l10n.reports),
          ProfileShellPage(onLogout: _logout),
        ];
    }
  }
}

class PlaceholderShellPage extends StatelessWidget {
  const PlaceholderShellPage({
    super.key,
    required this.title,
    this.message,
    this.onLogout,
  });

  final String title;
  final String? message;
  final VoidCallback? onLogout;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (onLogout == null) {
      return EmptyState(title: title, subtitle: l10n.emptyDashboard);
    }
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Spacer(),
          Icon(
            Icons.no_accounts_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            message ?? l10n.unsupportedRoleBody,
            textAlign: TextAlign.center,
          ),
          const Spacer(),
          PrimaryButton(label: l10n.logout, onPressed: onLogout),
        ],
      ),
    );
  }
}

class ProfileShellPage extends StatelessWidget {
  const ProfileShellPage({super.key, required this.onLogout});

  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.settings, style: Theme.of(context).textTheme.headlineSmall),
          const Spacer(),
          PrimaryButton(label: l10n.logout, onPressed: onLogout),
        ],
      ),
    );
  }
}
