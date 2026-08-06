import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../../core/widgets/home_mosaic.dart';
import '../../auth/domain/auth_user.dart';
import '../../dashboard/presentation/home_shell_screen.dart';
import '../../notifications/data/notifications_repository.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

class ReviewerHomeScreen extends ConsumerStatefulWidget {
  const ReviewerHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<ReviewerHomeScreen> createState() => _ReviewerHomeScreenState();
}

class _ReviewerHomeScreenState extends ConsumerState<ReviewerHomeScreen> {
  ReviewerDashboardData? _data;
  Map<String, dynamic>? _report;
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
      final repo = ref.read(reviewerRepositoryProvider);
      final results = await Future.wait([
        repo.loadReviewerDashboard(userId: widget.user.id),
        repo.academicUniversityReport(userId: widget.user.id),
      ]);
      setState(() {
        _data = results[0] as ReviewerDashboardData;
        _report = results[1] as Map<String, dynamic>?;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openPriority(ReviewerPriorityAction action) {
    switch (action.type) {
      case ReviewerPriorityType.decideRecognition:
        context.push('/reviewer/recognition/${action.targetId}');
        return;
      case ReviewerPriorityType.decideEnrollment:
        context.push('/reviewer/enrollments');
        return;
      case ReviewerPriorityType.openQaReview:
        return;
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
    final priority = data?.reviewerPriorityAction;
    final summary = _report?['summary'];
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
        children: [
          if (data?.fromCache == true)
            InfoBanner(
              message:
                  '${l10n.offlineCachedBanner}'
                  '${data?.cachedAt != null ? ' · ${l10n.lastUpdatedAt(data!.cachedAt!.toLocal().toString().split('.').first)}' : ''}',
            ),
          if (priority != null) ...[
            const SizedBox(height: 8),
            ReviewerPriorityCard(
              title: priority.type == ReviewerPriorityType.decideRecognition
                  ? l10n.reviewerPriorityDecideRecognition
                  : l10n.reviewerPriorityDecideEnrollment,
              icon: priority.type == ReviewerPriorityType.decideRecognition
                  ? Icons.workspace_premium_outlined
                  : Icons.how_to_reg_outlined,
              onTap: () => _openPriority(priority),
            ),
          ],
        ],
      ),
      tiles: [
        HomeMosaicTileData(
          label: l10n.recognitionRequestsTitle,
          icon: Icons.workspace_premium_outlined,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: l10n.pendingRecognitionCount(
            data?.pendingRecognitionCount ?? 0,
          ),
          onTap: () => context.push('/reviewer/recognition'),
        ),
        HomeMosaicTileData(
          label: l10n.pendingEnrollmentsTitle,
          icon: Icons.how_to_reg_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          subtitle: l10n.pendingEnrollmentsCountLabel(
            data?.pendingEnrollmentsCount ?? 0,
          ),
          onTap: () => context.push('/reviewer/enrollments'),
        ),
        HomeMosaicTileData(
          label: l10n.trainees,
          icon: Icons.groups_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/reviewer/students'),
        ),
        HomeMosaicTileData(
          label: l10n.evidenceTitle,
          icon: Icons.folder_open_outlined,
          tone: HomeMosaicTone.accent,
          size: HomeMosaicSize.tall,
          onTap: () => context.push('/reviewer/evidence'),
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
          label: l10n.reviews,
          icon: Icons.rate_review_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 1,
        ),
      ],
      footer: [
        if (summary is Map) ...[
          AcademicSectionHeader(title: l10n.reports),
          const SizedBox(height: 8),
          ReviewerSoftCard(
            child: Column(
              children: [
                for (final entry in summary.entries)
                  if (reviewerSummaryLabel(l10n, entry.key.toString()) != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              reviewerSummaryLabel(l10n, entry.key.toString())!,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(color: BatColors.muted),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              entry.key.toString() == 'average_attendance'
                                  ? '${entry.value}%'
                                  : entry.value.toString(),
                              textAlign: TextAlign.end,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: BatColors.heading,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
