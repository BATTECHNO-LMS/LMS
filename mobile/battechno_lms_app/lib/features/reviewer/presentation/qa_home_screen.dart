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
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

class QaHomeScreen extends ConsumerStatefulWidget {
  const QaHomeScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<QaHomeScreen> createState() => _QaHomeScreenState();
}

class _QaHomeScreenState extends ConsumerState<QaHomeScreen> {
  ReviewerDashboardData? _data;
  List<Map<String, dynamic>> _recent = const [];
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
        repo.loadQaDashboard(userId: widget.user.id),
        repo.listQaReviews(userId: widget.user.id, allowCache: false),
      ]);
      final data = results[0] as ReviewerDashboardData;
      final page = results[1] as ReviewQueuePage;
      setState(() {
        _data = data;
        _recent = page.items.take(5).toList();
      });
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
    final priority = data?.qaPriorityAction;
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
        onNotificationsTap: () =>
            ref.read(shellTabIndexRequestProvider.notifier).state = 3,
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
              title: l10n.qaPriorityOpenReview,
              icon: Icons.rate_review_outlined,
              onTap: () => context.push('/qa/reviews/${priority.targetId}'),
            ),
          ],
        ],
      ),
      tiles: [
        HomeMosaicTileData(
          label: l10n.reviews,
          icon: Icons.rate_review_outlined,
          tone: HomeMosaicTone.primary,
          size: HomeMosaicSize.tall,
          subtitle: l10n.openQaReviewsCount(data?.openQaReviewsCount ?? 0),
          onTap: () => context.push('/qa/reviews'),
        ),
        HomeMosaicTileData(
          label: l10n.openCorrectiveActionsCount(
            data?.openCorrectiveCount ?? 0,
          ),
          icon: Icons.assignment_late_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/qa/reviews'),
        ),
        HomeMosaicTileData(
          label: l10n.openRiskCasesCount(data?.openRiskCount ?? 0),
          icon: Icons.warning_amber_outlined,
          tone: HomeMosaicTone.secondary,
          size: HomeMosaicSize.short,
          onTap: () => context.push('/qa/reviews'),
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
              ref.read(shellTabIndexRequestProvider.notifier).state = 2,
        ),
        HomeMosaicTileData(
          label: l10n.notifications,
          icon: Icons.notifications_outlined,
          tone: HomeMosaicTone.cream,
          size: HomeMosaicSize.medium,
          onTap: () =>
              ref.read(shellTabIndexRequestProvider.notifier).state = 3,
        ),
      ],
      footer: [
        AcademicSectionHeader(title: l10n.qaReviewsTitle),
        const SizedBox(height: 8),
        if (_recent.isEmpty)
          EmptyState(title: l10n.noQaReviews, subtitle: '')
        else
          for (final item in _recent) _RecentReviewTile(item: item),
      ],
    );
  }
}

class _RecentReviewTile extends StatelessWidget {
  const _RecentReviewTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final review = QaReviewItem(item);
    return ReviewerQueueCard(
      title: review.cohortTitle ?? review.reviewType,
      statusLabel: ReviewerLabels.qaStatus(l10n, review.status),
      status: review.status,
      subtitle: review.reviewDate,
      metaChips: [
        ReviewerLabels.reviewType(l10n, review.reviewType),
        if (review.reviewerName != null) review.reviewerName!,
      ],
      onTap: () => context.push('/qa/reviews/${review.id}'),
    );
  }
}
