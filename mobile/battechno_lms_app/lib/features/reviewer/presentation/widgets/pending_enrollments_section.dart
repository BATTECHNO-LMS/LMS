import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../../auth/domain/auth_user.dart';
import '../../data/reviewer_repository.dart';
import '../../domain/reviewer_models.dart';
import 'enrollment_decision_sheet.dart';

/// Embeddable pending-enrollments list with inline approve/reject actions.
/// Used both inside `ReviewerReviewsHubScreen` and the standalone
/// `/reviewer/enrollments` route.
class PendingEnrollmentsSection extends ConsumerStatefulWidget {
  const PendingEnrollmentsSection({super.key, required this.user});

  final AuthUser user;

  @override
  ConsumerState<PendingEnrollmentsSection> createState() =>
      _PendingEnrollmentsSectionState();
}

class _PendingEnrollmentsSectionState
    extends ConsumerState<PendingEnrollmentsSection> {
  List<Map<String, dynamic>> _items = const [];
  bool _loading = true;
  String? _error;
  String? _actingId;

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
      final page = await ref
          .read(reviewerRepositoryProvider)
          .listPendingEnrollments(userId: widget.user.id);
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

  Future<void> _decide(PendingEnrollmentItem item, bool approve) async {
    if (_actingId != null) return;
    final l10n = AppLocalizations.of(context);
    final confirmed = await showEnrollmentDecisionSheet(
      context: context,
      studentName: item.studentName ?? l10n.students,
      approve: approve,
    );
    if (confirmed == null || !mounted) return;

    setState(() => _actingId = item.id);
    try {
      final repo = ref.read(reviewerRepositoryProvider);
      if (approve) {
        await repo.approveEnrollment(item.id);
      } else {
        await repo.rejectEnrollment(item.id, reason: confirmed);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            approve ? l10n.enrollmentApproved : l10n.enrollmentRejected,
          ),
        ),
      );
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : (e.statusCode == 409 ? l10n.statusConflictRefresh : e.message);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      if (e.statusCode == 409) await _load();
    } finally {
      if (mounted) setState(() => _actingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _loading && _items.isEmpty
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
                  EmptyState(title: l10n.noPendingEnrollments, subtitle: '')
                else
                  for (final item in _items) ...[
                    _buildCard(l10n, item),
                    const SizedBox(height: 8),
                  ],
              ],
            ),
          );
  }

  Widget _buildCard(AppLocalizations l10n, Map<String, dynamic> item) {
    final enrollment = PendingEnrollmentItem(item);
    final busy = _actingId == enrollment.id;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              enrollment.studentName ?? l10n.students,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            if (enrollment.studentEmail != null) ...[
              const SizedBox(height: 4),
              Text(
                enrollment.studentEmail!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (enrollment.microCredentialTitle != null) ...[
              const SizedBox(height: 6),
              Text(enrollment.microCredentialTitle!),
            ],
            if (enrollment.cohortTitle != null) ...[
              const SizedBox(height: 2),
              Text(
                enrollment.cohortTitle!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : () => _decide(enrollment, false),
                    child: Text(l10n.enrollmentRejectAction),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PrimaryButton(
                    label: l10n.enrollmentApproveAction,
                    isLoading: busy,
                    onPressed: busy ? null : () => _decide(enrollment, true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
