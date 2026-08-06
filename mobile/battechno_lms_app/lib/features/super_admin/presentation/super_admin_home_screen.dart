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
import '../data/super_admin_repository.dart';
import '../domain/super_admin_models.dart';

class SuperAdminHomeScreen extends ConsumerStatefulWidget {
  const SuperAdminHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<SuperAdminHomeScreen> createState() =>
      _SuperAdminHomeScreenState();
}

class _SuperAdminHomeScreenState extends ConsumerState<SuperAdminHomeScreen> {
  SuperAdminStats? _stats;
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
      final stats = await ref
          .read(superAdminRepositoryProvider)
          .loadDashboardStats(userId: widget.user.id);
      setState(() => _stats = stats);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading && _stats == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network' && _stats == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    final stats = _stats;
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
        greeting: _greeting(l10n),
        fullName: widget.user.fullName,
        subtitle: l10n.superAdminGlobalScopeNotice,
        profileActionLabel: l10n.profile,
        onProfileTap: () =>
            ref.read(shellTabIndexRequestProvider.notifier).state = 4,
        notificationsTooltip: l10n.notifications,
        unreadCount: unread,
        onNotificationsTap: () => context.push('/notifications'),
      ),
      banner: _error != null && stats == null
          ? InfoBanner(message: l10n.networkErrorBody)
          : null,
      tiles: [
        HomeMosaicTileData(
          label: l10n.universities,
          icon: Icons.account_balance_outlined,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: stats != null ? '${stats.universities}' : null,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 1,
        ),
        HomeMosaicTileData(
          label: l10n.users,
          icon: Icons.group_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          subtitle: stats != null ? '${stats.users}' : null,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 2,
        ),
        HomeMosaicTileData(
          label: l10n.superAdminFieldTrainingOversight,
          icon: Icons.hiking_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/super/field-training'),
        ),
        HomeMosaicTileData(
          label: l10n.superAdminQaOversight,
          icon: Icons.fact_check_outlined,
          tone: HomeMosaicTone.accent,
          size: HomeMosaicSize.tall,
          onTap: () => context.push('/super/qa'),
        ),
        HomeMosaicTileData(
          label: l10n.auditLogsTitle,
          icon: Icons.receipt_long_outlined,
          tone: HomeMosaicTone.soft,
          size: HomeMosaicSize.medium,
          onTap: () => context.push('/super/audit'),
        ),
        HomeMosaicTileData(
          label: l10n.systemStatusTitle,
          icon: Icons.monitor_heart_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () => context.push('/super/system-status'),
        ),
        HomeMosaicTileData(
          label: l10n.certificatesTitle,
          icon: Icons.workspace_premium_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/super/certificates'),
        ),
        HomeMosaicTileData(
          label: l10n.reports,
          icon: Icons.analytics_outlined,
          tone: HomeMosaicTone.soft,
          size: HomeMosaicSize.short,
          subtitle: stats != null
              ? l10n.superAdminPendingEnrollmentsLabel
              : null,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 3,
        ),
      ],
    );
  }

  String _greeting(AppLocalizations l10n) {
    final hour = DateTime.now().hour;
    return hour < 17 ? l10n.greetingMorning : l10n.greetingEvening;
  }
}
