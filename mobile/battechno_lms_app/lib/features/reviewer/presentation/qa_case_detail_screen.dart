import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

enum QaCaseKind { corrective, risk, integrity }

/// Shared detail screen for corrective actions, risk cases, and integrity
/// cases — same shape (status decision sheet limited to valid next
/// statuses, confirmation, duplicate-tap guard, 400/409 refresh).
class QaCaseDetailScreen extends ConsumerStatefulWidget {
  const QaCaseDetailScreen({super.key, required this.kind, required this.id});

  final QaCaseKind kind;
  final String id;

  @override
  ConsumerState<QaCaseDetailScreen> createState() => _QaCaseDetailScreenState();
}

class _QaCaseDetailScreenState extends ConsumerState<QaCaseDetailScreen> {
  Map<String, dynamic>? _item;
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
      final repo = ref.read(reviewerRepositoryProvider);
      final data = switch (widget.kind) {
        QaCaseKind.corrective => await repo.getCorrectiveAction(widget.id),
        QaCaseKind.risk => await repo.getRiskCase(widget.id),
        QaCaseKind.integrity => await repo.getIntegrityCase(widget.id),
      };
      if (data == null) {
        setState(() => _error = 'forbidden');
        return;
      }
      setState(() => _item = data);
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

  List<String> _nextStatuses(String? current) {
    switch (widget.kind) {
      case QaCaseKind.corrective:
        return nextCorrectiveStatuses(current);
      case QaCaseKind.risk:
        return nextRiskStatuses(current);
      case QaCaseKind.integrity:
        return nextIntegrityStatuses(current);
    }
  }

  String _statusLabel(AppLocalizations l10n, String? status) {
    switch (widget.kind) {
      case QaCaseKind.corrective:
        return ReviewerLabels.correctiveStatus(l10n, status);
      case QaCaseKind.risk:
        return ReviewerLabels.riskStatus(l10n, status);
      case QaCaseKind.integrity:
        return ReviewerLabels.integrityStatus(l10n, status);
    }
  }

  String _title(AppLocalizations l10n) {
    switch (widget.kind) {
      case QaCaseKind.corrective:
        return l10n.correctiveActionsTitle;
      case QaCaseKind.risk:
        return l10n.riskCasesTitle;
      case QaCaseKind.integrity:
        return l10n.integrityCasesTitle;
    }
  }

  Future<Map<String, dynamic>> _patchStatus(String status) {
    final repo = ref.read(reviewerRepositoryProvider);
    switch (widget.kind) {
      case QaCaseKind.corrective:
        return repo.patchCorrectiveStatus(widget.id, status);
      case QaCaseKind.risk:
        return repo.patchRiskCaseStatus(widget.id, status);
      case QaCaseKind.integrity:
        return repo.patchIntegrityCaseStatus(widget.id, status);
    }
  }

  String? _resultKey() {
    switch (widget.kind) {
      case QaCaseKind.corrective:
        return 'corrective_action';
      case QaCaseKind.risk:
        return 'risk_case';
      case QaCaseKind.integrity:
        return 'integrity_case';
    }
  }

  Future<void> _changeStatus() async {
    if (_acting || _item == null) return;
    final l10n = AppLocalizations.of(context);
    final current = _item!['status']?.toString();
    final chosen = await showStatusDecisionSheet(
      context: context,
      options: _nextStatuses(current),
      labelBuilder: (s) => _statusLabel(l10n, s),
    );
    if (chosen == null) return;
    final confirmed = await showConfirmationSheet(
      context: context,
      title: l10n.confirmStatusChangeTitle,
      body: l10n.confirmStatusChangeBody(_statusLabel(l10n, chosen)),
    );
    if (confirmed == null || !mounted) return;

    setState(() => _acting = true);
    try {
      final data = await _patchStatus(chosen);
      final key = _resultKey();
      final updated = key != null ? data[key] : null;
      if (updated is Map<String, dynamic>) {
        setState(() => _item = updated);
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

  List<Widget> _fields(AppLocalizations l10n, Map<String, dynamic> item) {
    switch (widget.kind) {
      case QaCaseKind.corrective:
        final action = CorrectiveActionItem(item);
        return [
          _kv(l10n.dueDate, action.dueDate ?? '—'),
          _kv(l10n.correctiveAssigneeLabel, action.assigneeName ?? '—'),
          const SizedBox(height: 8),
          Text(action.actionText ?? '—'),
        ];
      case QaCaseKind.risk:
        final risk = RiskCaseItem(item);
        return [
          _kv(l10n.students, risk.studentName ?? '—'),
          _kv(
            l10n.riskTypeLabel,
            ReviewerLabels.humanizeSnakeCase(risk.riskType),
          ),
          _kv(
            l10n.riskLevelLabel,
            ReviewerLabels.humanizeSnakeCase(risk.riskLevel),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.riskActionPlanLabel,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          Text(risk.actionPlan ?? '—'),
        ];
      case QaCaseKind.integrity:
        final integrity = IntegrityCaseItem(item);
        return [
          _kv(l10n.students, integrity.studentName ?? '—'),
          _kv(
            l10n.integrityCaseTypeLabel,
            ReviewerLabels.humanizeSnakeCase(integrity.caseType),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.integrityEvidenceNotesLabel,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          Text(integrity.evidenceNotes ?? '—'),
          const SizedBox(height: 8),
          Text(
            l10n.integrityDecisionLabel,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          Text(integrity.decision ?? '—'),
        ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final item = _item;

    return Scaffold(
      appBar: AppBar(title: Text(_title(l10n))),
      body: _loading && item == null
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 6),
            )
          : _error != null && item == null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : _error == 'not_found'
                  ? l10n.resourceNotFound
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : item == null
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
                          _title(l10n),
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      ReviewerStatusChip(
                        label: _statusLabel(l10n, item['status']?.toString()),
                        status: item['status']?.toString(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _fields(l10n, item),
                      ),
                    ),
                  ),
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

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
