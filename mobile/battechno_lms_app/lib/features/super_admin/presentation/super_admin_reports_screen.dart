import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/super_admin_repository.dart';

/// Global field-training report summary (`super_admin`-only
/// `/admin/field-training/reports/global`) plus a per-university comparison
/// list. Exports (PDF/Excel) are web-only — messaged accordingly rather
/// than attempted on mobile.
class SuperAdminReportsScreen extends ConsumerStatefulWidget {
  const SuperAdminReportsScreen({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<SuperAdminReportsScreen> createState() =>
      _SuperAdminReportsScreenState();
}

class _SuperAdminReportsScreenState
    extends ConsumerState<SuperAdminReportsScreen> {
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
      final report = await ref
          .read(superAdminRepositoryProvider)
          .globalFtReport(userId: widget.user.id);
      setState(() => _report = report);
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

  int _asInt(dynamic v) {
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final summary = _report?['summary'];
    final universityComparison =
        (_report?['university_comparison'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList();

    if (_loading && _report == null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && _report == null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.superAdminGlobalReportTitle,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (summary is Map)
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.6,
              children: [
                _statCard(
                  l10n.universities,
                  _asInt(summary['universities_count']),
                ),
                _statCard(
                  l10n.opportunities,
                  _asInt(summary['opportunities_count']),
                ),
                _statCard(
                  l10n.adminReportTotalApplicants,
                  _asInt(summary['applications_count']),
                ),
                _statCard(
                  l10n.adminReportAcceptedStudents,
                  _asInt(summary['accepted_count']),
                ),
                _statCard(
                  l10n.superAdminExpelledLabel,
                  _asInt(summary['expelled_count']),
                ),
                _statCard(
                  l10n.adminReportCompletionLetters,
                  _asInt(summary['completion_letters_count']),
                ),
              ],
            )
          else
            EmptyState(title: l10n.emptyDashboard),
          const SizedBox(height: 20),
          AcademicSectionHeader(
            title: l10n.superAdminUniversityComparisonTitle,
          ),
          const SizedBox(height: 8),
          if (universityComparison.isEmpty)
            EmptyState(title: l10n.emptyDashboard)
          else
            for (final row in universityComparison) ...[
              Card(
                child: ListTile(
                  title: Text(row['university_name']?.toString() ?? '—'),
                  subtitle: Text(
                    '${l10n.adminReportTotalApplicants}: '
                    '${_asInt(row['total_applicants'])} • '
                    '${l10n.adminReportAcceptedStudents}: '
                    '${_asInt(row['accepted'])}',
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          const SizedBox(height: 16),
          InfoBanner(message: l10n.superAdminReportExportWebOnlyNotice),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => context.push('/super/field-training'),
            icon: const Icon(Icons.hiking_outlined),
            label: Text(l10n.superAdminFieldTrainingOversight),
          ),
        ],
      ),
    );
  }

  Widget _statCard(String label, int value) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '$value',
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
