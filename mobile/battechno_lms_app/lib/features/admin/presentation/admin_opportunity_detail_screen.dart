import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';

class AdminOpportunityDetailScreen extends ConsumerStatefulWidget {
  const AdminOpportunityDetailScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminOpportunityDetailScreen> createState() =>
      _AdminOpportunityDetailScreenState();
}

class _AdminOpportunityDetailScreenState
    extends ConsumerState<AdminOpportunityDetailScreen> {
  Map<String, dynamic>? _opportunity;
  bool _loading = true;
  String? _error;
  bool _acting = false;

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
          .read(adminRepositoryProvider)
          .getOpportunity(widget.opportunityId);
      final opp = data['opportunity'];
      setState(() {
        _opportunity = opp is Map<String, dynamic> ? opp : data;
      });
    } on ApiException catch (e) {
      setState(() {
        if (e.statusCode == 403) {
          _error = 'forbidden';
        } else if (e.statusCode == 404) {
          _error = 'not_found';
        } else {
          _error = e.isNetwork ? 'network' : e.message;
        }
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _mapError(AppLocalizations l10n) {
    switch (_error) {
      case 'forbidden':
        return l10n.forbiddenAccess;
      case 'not_found':
        return l10n.resourceNotFound;
      case 'network':
        return l10n.networkErrorBody;
      default:
        return _error ?? l10n.resourceNotFound;
    }
  }

  Future<void> _confirmAndRun({
    required String title,
    required String body,
    required Future<void> Function() action,
    required String successMessage,
  }) async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.stayAndEdit),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.continueAction),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _acting = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : e.statusCode == 404
          ? l10n.resourceNotFound
          : e.message;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _acting = false);
    }
  }

  Future<void> _publish() async {
    final l10n = AppLocalizations.of(context);
    await _confirmAndRun(
      title: l10n.publishOpportunity,
      body: l10n.confirmPublishBody,
      action: () =>
          ref.read(adminRepositoryProvider).publish(widget.opportunityId),
      successMessage: l10n.opportunityPublished,
    );
  }

  Future<void> _archive() async {
    final l10n = AppLocalizations.of(context);
    await _confirmAndRun(
      title: l10n.archiveOpportunity,
      body: l10n.confirmArchiveBody,
      action: () =>
          ref.read(adminRepositoryProvider).archive(widget.opportunityId),
      successMessage: l10n.opportunityArchived,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.opportunities)),
        body: const Padding(
          padding: EdgeInsets.all(16),
          child: LoadingSkeleton(lines: 6),
        ),
      );
    }
    if (_error != null && _opportunity == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.opportunities)),
        body: RetryView(
          title: l10n.networkErrorTitle,
          message: _mapError(l10n),
          onRetry: _load,
        ),
      );
    }

    final opp = AdminOpportunity(_opportunity ?? {});
    final id = widget.opportunityId;

    return Scaffold(
      appBar: AppBar(
        title: Text(opp.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            tooltip: l10n.editOpportunity,
            onPressed: () => context.push('/admin/field-training/$id/edit'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.opportunityInfo,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    _row(
                      l10n.certificateStatus,
                      AdminLabels.statusAr(opp.status),
                    ),
                    _row(l10n.specialty, opp.specialtyName ?? '—'),
                    _row('', AdminLabels.modeAr(opp.trainingMode)),
                    _row(
                      l10n.requiredHoursLabel,
                      opp.requiredHours?.toString() ?? l10n.hoursNotSpecified,
                    ),
                    _row(
                      l10n.assignedInstructorLabel,
                      opp.instructorName ?? '—',
                    ),
                    if (opp.startDate != null || opp.endDate != null)
                      _row(
                        '',
                        '${opp.startDate ?? '—'} → ${opp.endDate ?? '—'}',
                      ),
                  ],
                ),
              ),
            ),
            if (opp.needsEligibilitySetup) ...[
              const SizedBox(height: 8),
              InfoBanner(message: l10n.needsEligibilitySetupNotice),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                if (opp.status == 'draft')
                  Expanded(
                    child: PrimaryButton(
                      label: l10n.publishOpportunity,
                      isLoading: _acting,
                      onPressed: _publish,
                    ),
                  ),
                if (opp.status == 'published' ||
                    opp.status == 'in_progress') ...[
                  Expanded(
                    child: SecondaryButton(
                      label: l10n.archiveOpportunity,
                      onPressed: _acting ? null : _archive,
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            Text(
              l10n.quickActions,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _nav(l10n.reviewApplications, Icons.fact_check_outlined, () {
              context.push('/admin/field-training/$id/applications');
            }),
            _nav(l10n.viewSessions, Icons.event_outlined, () {
              context.push('/admin/field-training/$id/sessions');
            }),
            _nav(l10n.viewSubmissions, Icons.assignment_outlined, () {
              context.push('/admin/field-training/$id/submissions');
            }),
            _nav(l10n.viewAssessmentResults, Icons.quiz_outlined, () {
              context.push('/admin/field-training/$id/assessments');
            }),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          if (label.isNotEmpty) ...[
            Expanded(child: Text(label)),
            Expanded(
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ] else
            Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _nav(String label, IconData icon, VoidCallback onTap) {
    return Card(
      child: ListTile(
        leading: Icon(icon),
        title: Text(label),
        trailing: const Icon(Icons.chevron_left),
        onTap: onTap,
      ),
    );
  }
}
