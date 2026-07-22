import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_models.dart';

/// `university_reviewer` home — pending recognition and enrollment counts,
/// plus the university field-training report summary when available.
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
                onTap: () => _openPriority(priority),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(
                        priority.type == ReviewerPriorityType.decideRecognition
                            ? Icons.workspace_premium_outlined
                            : Icons.how_to_reg_outlined,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          priority.type ==
                                  ReviewerPriorityType.decideRecognition
                              ? l10n.reviewerPriorityDecideRecognition
                              : l10n.reviewerPriorityDecideEnrollment,
                        ),
                      ),
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
                l10n.pendingRecognitionCount(
                  data?.pendingRecognitionCount ?? 0,
                ),
                Icons.workspace_premium_outlined,
              ),
              _chip(
                l10n.pendingEnrollmentsCountLabel(
                  data?.pendingEnrollmentsCount ?? 0,
                ),
                Icons.how_to_reg_outlined,
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
            onPressed: () => context.push('/reviewer/recognition'),
            icon: const Icon(Icons.workspace_premium_outlined),
            label: Text(l10n.recognitionRequestsTitle),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/reviewer/enrollments'),
            icon: const Icon(Icons.how_to_reg_outlined),
            label: Text(l10n.pendingEnrollmentsTitle),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.push('/reviewer/students'),
            icon: const Icon(Icons.groups_outlined),
            label: Text(l10n.trainees),
          ),
          if (summary is Map) ...[
            const SizedBox(height: 24),
            Text(
              l10n.reports,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${l10n.adminReportAcceptedStudents}: '
                      '${summary['accepted_students'] ?? '—'}',
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${l10n.adminReportCompletedStudents}: '
                      '${summary['completed_students'] ?? '—'}',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip(String label, IconData icon) {
    return Chip(avatar: Icon(icon, size: 18), label: Text(label));
  }
}
