import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';
import 'widgets/reviewer_widgets.dart';

/// University-scoped academic field-training report summary — shared by
/// `qa_officer` and `university_reviewer` (`canReadFtReports`), matching the
/// admin report card layout. Read-only, no export actions on mobile.
class ReviewerReportsScreen extends ConsumerStatefulWidget {
  const ReviewerReportsScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<ReviewerReportsScreen> createState() =>
      _ReviewerReportsScreenState();
}

class _ReviewerReportsScreenState extends ConsumerState<ReviewerReportsScreen> {
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
      final data = await ref
          .read(reviewerRepositoryProvider)
          .academicUniversityReport(userId: widget.user.id);
      setState(() => _report = data);
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 403
            ? 'forbidden'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int? _asInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final summary = _report?['summary'];
    final university = _report?['university'];

    return ColoredBox(
      color: kReviewerPageBg,
      child: _loading && _report == null
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 5),
            )
          : _error != null && _report == null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  ReviewerSoftCard(
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: BatColors.primarySoft,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.analytics_outlined,
                            color: BatColors.primary,
                            size: 26,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.reports,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: BatColors.heading,
                                    ),
                              ),
                              if (university is Map &&
                                  university['name'] != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  university['name'].toString(),
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(color: BatColors.muted),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (summary is Map) ...[
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 1.55,
                      children: [
                        _statCard(
                          l10n.adminReportEligibleOpportunities,
                          _asInt(summary['eligible_opportunities']),
                        ),
                        _statCard(
                          l10n.adminReportTotalApplicants,
                          _asInt(summary['total_applicants']),
                        ),
                        _statCard(
                          l10n.adminReportAcceptedStudents,
                          _asInt(summary['accepted_students']),
                        ),
                        _statCard(
                          l10n.adminReportInTraining,
                          _asInt(summary['in_training_students']),
                        ),
                        _statCard(
                          l10n.adminReportCompletedStudents,
                          _asInt(summary['completed_students']),
                        ),
                        _statCard(
                          l10n.adminReportCompletionLetters,
                          _asInt(summary['completion_letters_issued']),
                        ),
                      ],
                    ),
                    if (summary['average_attendance'] != null) ...[
                      const SizedBox(height: 12),
                      ReviewerSoftCard(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: BatColors.accentSoft,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.how_to_reg_outlined,
                                color: BatColors.accentHover,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                '${l10n.attendance}: ${summary['average_attendance']}%',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: BatColors.heading,
                                      height: 1.4,
                                    ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ] else
                    EmptyState(title: l10n.emptyDashboard, subtitle: ''),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => context.push('/reviewer/students'),
                      icon: const Icon(Icons.groups_outlined, size: 18),
                      label: Text(
                        l10n.trainees,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: BatColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, int? value) {
    return ReviewerSoftCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value?.toString() ?? '—',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: BatColors.primary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: BatColors.muted,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}
