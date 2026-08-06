import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../../core/widgets/home_mosaic.dart';
import '../../auth/domain/auth_user.dart';
import '../../dashboard/presentation/home_shell_screen.dart';
import '../../notifications/data/notifications_repository.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';
import 'widgets/admin_widgets.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  AdminDashboardData? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref
          .read(adminRepositoryProvider)
          .loadDashboard(userId: widget.user.id, role: widget.user.primaryRole);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPriority(AdminPriorityAction action) {
    switch (action.type) {
      case AdminPriorityType.reviewSubmissions:
        context.push(
          '/admin/field-training/${action.opportunityId}/applications',
        );
      case AdminPriorityType.reviewApplications:
        context.push(
          '/admin/field-training/${action.opportunityId}/applications',
        );
      case AdminPriorityType.completeSetup:
        context.push('/admin/field-training/${action.opportunityId}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading && _data == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error == 'network' && _data == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final data = _data;
    final priority = data?.priorityAction;
    final ftStats = data?.ftStats;
    final unread =
        ref
            .watch(notificationsControllerProvider)
            .valueOrNull
            ?.notifications
            .where((n) => !n.isRead)
            .length ??
        0;

    return HomeMosaicScaffold(
      onRefresh: _load,
      header: HomeMosaicHeader(
        greeting: l10n.greetingMorning,
        fullName: widget.user.fullName,
        subtitle: widget.user.universityName,
        profileActionLabel: l10n.profile,
        onProfileTap: () =>
            ref.read(shellTabIndexRequestProvider.notifier).state = 4,
        notificationsTooltip: l10n.notifications,
        unreadCount: unread,
        onNotificationsTap: () => context.push('/notifications'),
      ),
      banner: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (data?.fromCache == true)
            InfoBanner(
              message:
                  '${l10n.offlineCachedBanner}'
                  '${data?.cachedAt != null ? ' · ${l10n.lastUpdatedAt(data!.cachedAt!.toLocal().toString().split('.').first)}' : ''}',
            ),
          if (priority != null) ...[
            const SizedBox(height: 8),
            AdminPriorityCard(
              action: priority,
              onTap: () => _openPriority(priority),
            ),
          ],
        ],
      ),
      tiles: [
        HomeMosaicTileData(
          label: l10n.opportunities,
          icon: Icons.work_outline,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: l10n.adminOpportunitiesCount(
            ftStats?.totalOpportunities ?? 0,
          ),
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 1,
        ),
        HomeMosaicTileData(
          label: l10n.createOpportunity,
          icon: Icons.add_circle_outline,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/admin/field-training/new'),
        ),
        HomeMosaicTileData(
          label: l10n.trainees,
          icon: Icons.groups_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 2,
        ),
        HomeMosaicTileData(
          label: l10n.adminPendingApplicationsCount(
            ftStats?.pendingApplications ?? 0,
          ),
          icon: Icons.fact_check_outlined,
          tone: HomeMosaicTone.accent,
          size: HomeMosaicSize.tall,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 1,
        ),
        HomeMosaicTileData(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          tone: HomeMosaicTone.soft,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 3,
        ),
        HomeMosaicTileData(
          label: l10n.adminPendingUsersCount(data?.pendingUsersCount ?? 0),
          icon: Icons.person_add_alt_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 4,
        ),
      ],
    );
  }
}
