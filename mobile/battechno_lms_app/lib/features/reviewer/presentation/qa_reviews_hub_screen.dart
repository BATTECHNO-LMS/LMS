import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/reviewer_repository.dart';
import '../domain/reviewer_labels.dart';
import '../domain/reviewer_models.dart';
import 'widgets/reviewer_widgets.dart';

enum _QaDomain { qaReviews, corrective, risk, integrity }

/// `qa_officer` reviews hub — QA reviews | Corrective | Risk | Integrity,
/// filtered by status, with search and pull-to-refresh. Mobile cards only.
class QaReviewsHubScreen extends ConsumerStatefulWidget {
  const QaReviewsHubScreen({super.key});

  @override
  ConsumerState<QaReviewsHubScreen> createState() => _QaReviewsHubScreenState();
}

class _QaReviewsHubScreenState extends ConsumerState<QaReviewsHubScreen> {
  _QaDomain _domain = _QaDomain.qaReviews;
  String? _status;
  String _search = '';
  List<Map<String, dynamic>> _items = const [];
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
      final page = await switch (_domain) {
        _QaDomain.qaReviews => repo.listQaReviews(
          status: _status,
          search: _search,
        ),
        _QaDomain.corrective => repo.listCorrectiveActions(
          status: _status,
          search: _search,
        ),
        _QaDomain.risk => repo.listRiskCases(status: _status, search: _search),
        _QaDomain.integrity => repo.listIntegrityCases(
          status: _status,
          search: _search,
        ),
      };
      setState(() => _items = page.items);
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

  void _switchDomain(_QaDomain domain) {
    setState(() {
      _domain = domain;
      _status = null;
      _items = const [];
    });
    _load();
  }

  List<String> _statusOptions(AppLocalizations l10n) {
    switch (_domain) {
      case _QaDomain.qaReviews:
        return ReviewerStatusOptions.qaStatuses;
      case _QaDomain.corrective:
        return ReviewerStatusOptions.correctiveStatuses;
      case _QaDomain.risk:
        return ReviewerStatusOptions.riskStatuses;
      case _QaDomain.integrity:
        return ReviewerStatusOptions.integrityStatuses;
    }
  }

  String _statusLabel(AppLocalizations l10n, String status) {
    switch (_domain) {
      case _QaDomain.qaReviews:
        return ReviewerLabels.qaStatus(l10n, status);
      case _QaDomain.corrective:
        return ReviewerLabels.correctiveStatus(l10n, status);
      case _QaDomain.risk:
        return ReviewerLabels.riskStatus(l10n, status);
      case _QaDomain.integrity:
        return ReviewerLabels.integrityStatus(l10n, status);
    }
  }

  String _domainLabel(AppLocalizations l10n, _QaDomain domain) {
    switch (domain) {
      case _QaDomain.qaReviews:
        return l10n.qaReviewsTitle;
      case _QaDomain.corrective:
        return l10n.correctiveActionsTitle;
      case _QaDomain.risk:
        return l10n.riskCasesTitle;
      case _QaDomain.integrity:
        return l10n.integrityCasesTitle;
    }
  }

  String _emptyLabel(AppLocalizations l10n) {
    switch (_domain) {
      case _QaDomain.qaReviews:
        return l10n.noQaReviews;
      case _QaDomain.corrective:
        return l10n.noCorrectiveActions;
      case _QaDomain.risk:
        return l10n.noRiskCases;
      case _QaDomain.integrity:
        return l10n.noIntegrityCases;
    }
  }

  void _openDetail(Map<String, dynamic> item) {
    final id = item['id']?.toString();
    if (id == null) return;
    switch (_domain) {
      case _QaDomain.qaReviews:
        context.push('/qa/reviews/$id');
        return;
      case _QaDomain.corrective:
        context.push('/qa/corrective/$id');
        return;
      case _QaDomain.risk:
        context.push('/qa/risk/$id');
        return;
      case _QaDomain.integrity:
        context.push('/qa/integrity/$id');
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: DomainFilterChips(
            labels: [for (final d in _QaDomain.values) _domainLabel(l10n, d)],
            selectedIndex: _QaDomain.values.indexOf(_domain),
            onSelected: (i) => _switchDomain(_QaDomain.values[i]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: TextField(
            decoration: InputDecoration(
              hintText: l10n.searchReviews,
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => _search = v,
            onSubmitted: (_) => _load(),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: Text(l10n.statusLabel),
                selected: _status == null,
                onSelected: (_) {
                  setState(() => _status = null);
                  _load();
                },
              ),
              for (final s in _statusOptions(l10n))
                ChoiceChip(
                  label: Text(_statusLabel(l10n, s)),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _loading && _items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: LoadingSkeleton(lines: 4),
                )
              : _error != null && _items.isEmpty
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
                      if (_items.isEmpty)
                        EmptyState(title: _emptyLabel(l10n), subtitle: '')
                      else
                        for (final item in _items) ...[
                          _buildCard(l10n, item),
                          const SizedBox(height: 8),
                        ],
                    ],
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildCard(AppLocalizations l10n, Map<String, dynamic> item) {
    switch (_domain) {
      case _QaDomain.qaReviews:
        final review = QaReviewItem(item);
        return ReviewerQueueCard(
          title: review.cohortTitle ?? l10n.qaReviewsTitle,
          statusLabel: ReviewerLabels.qaStatus(l10n, review.status),
          status: review.status,
          subtitle: review.findings,
          metaChips: [
            ReviewerLabels.reviewType(l10n, review.reviewType),
            if (review.reviewDate != null) review.reviewDate!,
            if (review.reviewerName != null) review.reviewerName!,
          ],
          onTap: () => _openDetail(item),
        );
      case _QaDomain.corrective:
        final action = CorrectiveActionItem(item);
        return ReviewerQueueCard(
          title: action.actionText ?? l10n.correctiveActionsTitle,
          statusLabel: ReviewerLabels.correctiveStatus(l10n, action.status),
          status: action.status,
          metaChips: [
            if (action.dueDate != null) '${l10n.dueDate}: ${action.dueDate}',
            if (action.assigneeName != null) action.assigneeName!,
          ],
          onTap: () => _openDetail(item),
        );
      case _QaDomain.risk:
        final risk = RiskCaseItem(item);
        return ReviewerQueueCard(
          title: risk.studentName ?? l10n.riskCasesTitle,
          statusLabel: ReviewerLabels.riskStatus(l10n, risk.status),
          status: risk.status,
          subtitle: risk.actionPlan,
          metaChips: [
            ReviewerLabels.humanizeSnakeCase(risk.riskType),
            ReviewerLabels.humanizeSnakeCase(risk.riskLevel),
          ],
          onTap: () => _openDetail(item),
        );
      case _QaDomain.integrity:
        final integrity = IntegrityCaseItem(item);
        return ReviewerQueueCard(
          title: integrity.studentName ?? l10n.integrityCasesTitle,
          statusLabel: ReviewerLabels.integrityStatus(l10n, integrity.status),
          status: integrity.status,
          subtitle: integrity.evidenceNotes,
          metaChips: [ReviewerLabels.humanizeSnakeCase(integrity.caseType)],
          onTap: () => _openDetail(item),
        );
    }
  }
}
