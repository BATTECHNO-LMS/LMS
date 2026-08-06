import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';

const Color kReviewerPageBg = Color(0xFFF2F3F5);

class ReviewerSoftCard extends StatelessWidget {
  const ReviewerSoftCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(22);
    final content = Padding(padding: padding, child: child);
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: radius,
          border: Border.all(color: const Color(0xFFE6E8EC)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1A2330).withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: onTap == null
            ? content
            : Material(
                color: Colors.transparent,
                borderRadius: radius,
                child: InkWell(
                  onTap: onTap,
                  borderRadius: radius,
                  child: content,
                ),
              ),
      ),
    );
  }
}

InputDecoration reviewerSoftFieldDecoration(String label, {String? hint}) {
  return InputDecoration(
    labelText: label,
    hintText: hint,
    filled: true,
    fillColor: const Color(0xFFF7F8FA),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: BatColors.primary, width: 1.4),
    ),
  );
}

Color statusColor(String? status) {
  switch (status) {
    case 'open':
    case 'submitted':
    case 'under_investigation':
    case 'reported':
      return BatColors.info;
    case 'in_progress':
    case 'under_review':
    case 'needs_revision':
    case 'in_preparation':
    case 'ready_for_submission':
      return BatColors.warning;
    case 'resolved':
    case 'approved':
      return BatColors.success;
    case 'closed':
    case 'draft':
      return BatColors.muted;
    case 'overdue':
    case 'escalated':
    case 'rejected':
      return BatColors.danger;
    default:
      return BatColors.muted;
  }
}

class ReviewerStatusChip extends StatelessWidget {
  const ReviewerStatusChip({super.key, required this.label, this.status});

  final String label;
  final String? status;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Generic queue-item card used by QA reviews, corrective actions, risk
/// cases, integrity cases, recognition requests, pending enrollments, and
/// evidence lists — mobile cards only, no desktop tables.
class ReviewerQueueCard extends StatelessWidget {
  const ReviewerQueueCard({
    super.key,
    required this.title,
    required this.statusLabel,
    this.status,
    this.subtitle,
    this.metaChips = const [],
    required this.onTap,
  });

  final String title;
  final String statusLabel;
  final String? status;
  final String? subtitle;
  final List<String> metaChips;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ReviewerSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.fact_check_outlined,
                  color: BatColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                    height: 1.25,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ReviewerStatusChip(label: statusLabel, status: status),
            ],
          ),
          if (subtitle != null && subtitle!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: BatColors.muted,
                height: 1.35,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (metaChips.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final chip in metaChips)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7F8FA),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      chip,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: BatColors.heading,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Domain-switch filter row, used instead of a desktop-style `TabBar`.
class DomainFilterChips extends StatelessWidget {
  const DomainFilterChips({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6E8EC)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: Material(
                color: selectedIndex == i
                    ? BatColors.primarySoft
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () => onSelected(i),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Text(
                      labels[i],
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: selectedIndex == i
                            ? BatColors.primary
                            : const Color(0xFF8B93A0),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Icon + label/value row used on reviewer detail screens.
class ReviewerMetaRow extends StatelessWidget {
  const ReviewerMetaRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BatColors.primaryLight),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
        ),
      ],
    );
  }
}

/// Soft priority action card for the reviewer home banner.
class ReviewerPriorityCard extends StatelessWidget {
  const ReviewerPriorityCard({
    super.key,
    required this.title,
    required this.icon,
    this.subtitle,
    required this.onTap,
  });

  final String title;
  final IconData icon;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ReviewerSoftCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: BatColors.accentSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: BatColors.accentHover, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: BatColors.muted,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted, size: 20),
        ],
      ),
    );
  }
}

/// Maps academic report summary keys to localized labels (known fields only).
String? reviewerSummaryLabel(AppLocalizations l10n, String key) {
  switch (key) {
    case 'eligible_opportunities':
      return l10n.adminReportEligibleOpportunities;
    case 'total_applicants':
      return l10n.adminReportTotalApplicants;
    case 'accepted_students':
      return l10n.adminReportAcceptedStudents;
    case 'in_training_students':
      return l10n.adminReportInTraining;
    case 'completed_students':
      return l10n.adminReportCompletedStudents;
    case 'completion_letters_issued':
      return l10n.adminReportCompletionLetters;
    case 'average_attendance':
      return l10n.attendance;
    default:
      return null;
  }
}

/// Bottom sheet presenting only the valid next statuses for the current
/// item. Returns the chosen status, or null if cancelled.
Future<String?> showStatusDecisionSheet({
  required BuildContext context,
  required List<String> options,
  required String Function(String status) labelBuilder,
}) {
  final l10n = AppLocalizations.of(context);
  if (options.isEmpty) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.noStatusActionsAvailable)));
    return Future.value(null);
  }
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6E8EC),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                l10n.changeStatus,
                style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 8),
              for (final option in options)
                ReviewerSoftCard(
                  margin: const EdgeInsets.only(bottom: 8),
                  onTap: () => Navigator.pop(ctx, option),
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Text(
                    labelBuilder(option),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: BatColors.heading,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    },
  );
}

/// Simple confirm/cancel bottom sheet with an optional free-text note field.
Future<String?> showConfirmationSheet({
  required BuildContext context,
  required String title,
  String? body,
  bool withNoteField = false,
  String? noteLabel,
}) {
  final l10n = AppLocalizations.of(context);
  final noteCtrl = TextEditingController();
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
    ),
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE6E8EC),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            if (body != null && body.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                body,
                style: Theme.of(
                  ctx,
                ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
              ),
            ],
            if (withNoteField) ...[
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: reviewerSoftFieldDecoration(
                  noteLabel ?? l10n.adminNoteOptional,
                ),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(ctx, noteCtrl.text.trim()),
                style: FilledButton.styleFrom(
                  backgroundColor: BatColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Text(
                  l10n.continueAction,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(ctx),
              style: OutlinedButton.styleFrom(
                foregroundColor: BatColors.muted,
                side: const BorderSide(color: Color(0xFFE6E8EC)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(l10n.stayAndEdit),
            ),
          ],
        ),
      );
    },
  );
}
