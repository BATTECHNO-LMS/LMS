import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/domain/auth_user.dart';
import '../data/super_admin_repository.dart';
import 'widgets/super_admin_widgets.dart';

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

    return ColoredBox(
      color: kSaPageBg,
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
                  SaSoftCard(
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
                                l10n.superAdminGlobalReportTitle,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: BatColors.heading,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                l10n.superAdminGlobalScopeNotice,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: BatColors.muted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (summary is Map)
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 1.55,
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
                  const SizedBox(height: 18),
                  SaSectionHeader(
                    title: l10n.superAdminUniversityComparisonTitle,
                    count: universityComparison.isEmpty
                        ? null
                        : universityComparison.length,
                  ),
                  const SizedBox(height: 10),
                  if (universityComparison.isEmpty)
                    EmptyState(title: l10n.emptyDashboard)
                  else
                    for (final row in universityComparison)
                      _comparisonCard(l10n, row),
                  const SizedBox(height: 16),
                  SaInfoNotice(
                    message: l10n.superAdminReportExportWebOnlyNotice,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => context.push('/super/field-training'),
                      icon: const Icon(Icons.hiking_outlined, size: 18),
                      label: Text(
                        l10n.superAdminFieldTrainingOversight,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      style: saPrimaryButtonStyle(),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _statCard(String label, int value) {
    return SaSoftCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$value',
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

  Widget _comparisonCard(AppLocalizations l10n, Map<String, dynamic> row) {
    return SaSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row['university_name']?.toString() ?? '—',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
          const SizedBox(height: 10),
          SaMetaRow(
            icon: Icons.people_outline,
            label: l10n.adminReportTotalApplicants,
            value: '${_asInt(row['total_applicants'])}',
          ),
          const SizedBox(height: 8),
          SaMetaRow(
            icon: Icons.check_circle_outline,
            label: l10n.adminReportAcceptedStudents,
            value: '${_asInt(row['accepted'])}',
          ),
        ],
      ),
    );
  }
}
