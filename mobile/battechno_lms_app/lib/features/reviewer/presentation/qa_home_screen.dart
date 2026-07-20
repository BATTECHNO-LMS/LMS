import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_models.dart';

/// `qa_officer` home — chips for open QA reviews / corrective / risk, a
/// priority action pointing at the oldest open QA review, and a recent
/// list. No desktop KPI grid.
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

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.instructorGreeting(widget.user.fullName),
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          if (data?.fromCache == true) ...[
            const SizedBox(height: 8),
            InfoBanner(
              message:
                  '${l10n.offlineCachedBanner}'
                  '${data?.cachedAt != null ? ' · ${l10n.lastUpdatedAt(data!.cachedAt!.toLocal().toString().split('.').first)}' : ''}',
            ),
          ],
          const SizedBox(height: 16),
          if (priority != null) ...[
            Card(
              child: InkWell(
                onTap: () => context.push('/qa/reviews/${priority.targetId}'),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.rate_review_outlined),
                      const SizedBox(width: 12),
                      Expanded(child: Text(l10n.qaPriorityOpenReview)),
                      const Icon(Icons.chevron_left),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(
                l10n.openQaReviewsCount(data?.openQaReviewsCount ?? 0),
                Icons.rate_review_outlined,
              ),
              _chip(
                l10n.openCorrectiveActionsCount(data?.openCorrectiveCount ?? 0),
                Icons.assignment_late_outlined,
              ),
              _chip(
                l10n.openRiskCasesCount(data?.openRiskCount ?? 0),
                Icons.warning_amber_outlined,
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            l10n.quickActions,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/qa/reviews'),
            icon: const Icon(Icons.rate_review_outlined),
            label: Text(l10n.reviews),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/reviewer/evidence'),
            icon: const Icon(Icons.folder_open_outlined),
            label: Text(l10n.evidenceTitle),
          ),
          const SizedBox(height: 24),
          Text(
            l10n.qaReviewsTitle,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (_recent.isEmpty)
            EmptyState(title: l10n.noQaReviews, subtitle: '')
          else
            for (final item in _recent) ...[
              _RecentReviewTile(item: item),
              const SizedBox(height: 8),
            ],
        ],
      ),
    );
  }

  Widget _chip(String label, IconData icon) {
    return Chip(avatar: Icon(icon, size: 18), label: Text(label));
  }
}

class _RecentReviewTile extends StatelessWidget {
  const _RecentReviewTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final review = QaReviewItem(item);
    return Card(
      child: ListTile(
        onTap: () => context.push('/qa/reviews/${review.id}'),
        title: Text(review.cohortTitle ?? review.reviewType),
        subtitle: Text(review.reviewDate ?? ''),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}
