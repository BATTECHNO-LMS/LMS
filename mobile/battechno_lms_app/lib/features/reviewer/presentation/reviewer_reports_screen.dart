import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/reviewer_repository.dart';

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

    return Scaffold(
      body: _loading && _report == null
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
                padding: const EdgeInsets.all(16),
                children: [
                  if (university is Map && university['name'] != null)
                    Text(
                      university['name'].toString(),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  const SizedBox(height: 12),
                  if (summary is Map) ...[
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 8,
                      crossAxisSpacing: 8,
                      childAspectRatio: 1.6,
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
                      InfoBanner(
                        message:
                            '${l10n.attendance}: ${summary['average_attendance']}%',
                      ),
                    ],
                  ] else
                    EmptyState(title: l10n.emptyDashboard, subtitle: ''),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/reviewer/students'),
                    icon: const Icon(Icons.groups_outlined),
                    label: Text(l10n.trainees),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, int? value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              value?.toString() ?? '—',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
            ),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
