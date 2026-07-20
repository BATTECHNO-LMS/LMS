import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

/// QA review detail — header, cohort, findings, action required, related
/// corrective actions, and a status decision sheet limited to the valid
/// next statuses. Guards against duplicate taps and refreshes on 409/400
/// (stale transition) responses.
class QaReviewDetailScreen extends ConsumerStatefulWidget {
  const QaReviewDetailScreen({super.key, required this.reviewId});

  final String reviewId;

  @override
  ConsumerState<QaReviewDetailScreen> createState() =>
      _QaReviewDetailScreenState();
}

class _QaReviewDetailScreenState extends ConsumerState<QaReviewDetailScreen> {
  Map<String, dynamic>? _review;
  List<Map<String, dynamic>> _corrective = const [];
  bool _loading = true;
  bool _acting = false;
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
          .read(reviewerRepositoryProvider)
          .getQaReview(widget.reviewId, includeCorrective: true);
      if (data == null) {
        setState(() => _error = 'forbidden');
        return;
      }
      final review = data['qa_review'];
      setState(() {
        _review = review is Map<String, dynamic> ? review : null;
        _corrective = (data['corrective_actions'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList();
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 404
            ? 'not_found'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeStatus() async {
    if (_acting || _review == null) return;
    final l10n = AppLocalizations.of(context);
    final current = _review!['status']?.toString();
    final chosen = await showStatusDecisionSheet(
      context: context,
      options: nextQaStatuses(current),
      labelBuilder: (s) => ReviewerLabels.qaStatus(l10n, s),
    );
    if (chosen == null) return;
    final confirmed = await showConfirmationSheet(
      context: context,
      title: l10n.confirmStatusChangeTitle,
      body: l10n.confirmStatusChangeBody(ReviewerLabels.qaStatus(l10n, chosen)),
    );
    if (confirmed == null || !mounted) return;

    setState(() => _acting = true);
    try {
      final data = await ref
          .read(reviewerRepositoryProvider)
          .patchQaReviewStatus(widget.reviewId, chosen);
      final updated = data['qa_review'];
      if (updated is Map<String, dynamic>) {
        setState(() => _review = updated);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.statusChangeSaved)));
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 400 || e.statusCode == 409) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.statusConflictRefresh)));
        await _load();
      } else {
        final msg = e.statusCode == 403 ? l10n.forbiddenAccess : e.message;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final review = _review;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.qaReviewsTitle)),
      body: _loading && review == null
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 6),
            )
          : _error != null && review == null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : _error == 'not_found'
                  ? l10n.resourceNotFound
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : review == null
          ? EmptyState(title: l10n.resourceNotFound)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          QaReviewItem(review).cohortTitle ??
                              l10n.qaReviewsTitle,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      ReviewerStatusChip(
                        label: ReviewerLabels.qaStatus(
                          l10n,
                          review['status']?.toString(),
                        ),
                        status: review['status']?.toString(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _section(l10n.qaReviewTypeLabel, [
                    Text(
                      ReviewerLabels.reviewType(
                        l10n,
                        review['review_type']?.toString(),
                      ),
                    ),
                  ]),
                  _section(l10n.qaReviewDateLabel, [
                    Text(review['review_date']?.toString() ?? '—'),
                  ]),
                  _section(l10n.assignedReviewerLabel, [
                    Text(QaReviewItem(review).reviewerName ?? '—'),
                  ]),
                  _section(l10n.qaFindingsLabel, [
                    Text(
                      review['findings']?.toString().isNotEmpty == true
                          ? review['findings'].toString()
                          : '—',
                    ),
                  ]),
                  _section(l10n.qaActionRequiredLabel, [
                    Text(
                      review['action_required']?.toString().isNotEmpty == true
                          ? review['action_required'].toString()
                          : '—',
                    ),
                  ]),
                  if (_corrective.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      l10n.relatedCorrectiveActions,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    for (final action in _corrective) ...[
                      ReviewerQueueCard(
                        title:
                            action['action_text']?.toString() ??
                            l10n.correctiveActionsTitle,
                        statusLabel: ReviewerLabels.correctiveStatus(
                          l10n,
                          action['status']?.toString(),
                        ),
                        status: action['status']?.toString(),
                        onTap: () {},
                      ),
                      const SizedBox(height: 8),
                    ],
                  ],
                  const SizedBox(height: 16),
                  PrimaryButton(
                    label: l10n.changeStatus,
                    isLoading: _acting,
                    onPressed: _acting ? null : _changeStatus,
                  ),
                ],
              ),
            ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            ...children,
          ],
        ),
      ),
    );
  }
}
