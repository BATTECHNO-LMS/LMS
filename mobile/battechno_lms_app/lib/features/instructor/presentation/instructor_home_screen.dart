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
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorHomeScreen extends ConsumerStatefulWidget {
  const InstructorHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<InstructorHomeScreen> createState() =>
      _InstructorHomeScreenState();
}

class _InstructorHomeScreenState extends ConsumerState<InstructorHomeScreen> {
  InstructorDashboardData? _data;
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
          .read(instructorRepositoryProvider)
          .loadDashboard(userId: widget.user.id);
      setState(() => _data = data);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPriority(InstructorPriorityAction action) {
    switch (action.type) {
      case InstructorPriorityType.reviewSubmissions:
        context.push(
          '/instructor/field-training/${action.opportunityId}/submissions',
        );
      case InstructorPriorityType.upcomingSession:
      case InstructorPriorityType.recordAttendance:
        context.push(
          '/instructor/field-training/${action.opportunityId}/sessions',
        );
      case InstructorPriorityType.followUpStudents:
        context.push(
          '/instructor/field-training/${action.opportunityId}/participants',
        );
      case InstructorPriorityType.openTraining:
        context.push('/instructor/field-training/${action.opportunityId}');
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
    final firstOpp = data?.list.opportunities.isNotEmpty == true
        ? data!.list.opportunities.first
        : null;
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
            ref.read(shellTabIndexRequestProvider.notifier).state = 3,
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
            InstructorPriorityCard(
              action: priority,
              onTap: () => _openPriority(priority),
            ),
          ],
        ],
      ),
      tiles: [
        HomeMosaicTileData(
          label: l10n.myTrainings,
          icon: Icons.hiking_outlined,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: l10n.activeTrainingsCount(data?.activeCount ?? 0),
          onTap: () => context.push('/instructor/field-training'),
        ),
        HomeMosaicTileData(
          label: l10n.students,
          icon: Icons.groups_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          subtitle: l10n.activeStudentsCount(data?.list.totalParticipants ?? 0),
          enabled: firstOpp != null,
          onTap: firstOpp == null
              ? null
              : () => context.push(
                  '/instructor/field-training/${firstOpp.id}/participants',
                ),
        ),
        HomeMosaicTileData(
          label: l10n.pendingSubmissionsCount(
            data?.list.totalPendingSubmissions ?? 0,
          ),
          icon: Icons.assignment_late_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          enabled: firstOpp != null,
          onTap: firstOpp == null
              ? null
              : () => context.push(
                  '/instructor/field-training/${firstOpp.id}/submissions',
                ),
        ),
        HomeMosaicTileData(
          label: l10n.viewSessions,
          icon: Icons.event_outlined,
          tone: HomeMosaicTone.accent,
          size: HomeMosaicSize.tall,
          enabled: firstOpp != null,
          onTap: firstOpp == null
              ? null
              : () => context.push(
                  '/instructor/field-training/${firstOpp.id}/sessions',
                ),
        ),
        HomeMosaicTileData(
          label: l10n.atRiskStudentsCount(data?.list.totalAtRisk ?? 0),
          icon: Icons.warning_amber_outlined,
          tone: HomeMosaicTone.soft,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 2,
        ),
        HomeMosaicTileData(
          label: l10n.profile,
          icon: Icons.person_outline,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 3,
        ),
      ],
    );
  }
}
