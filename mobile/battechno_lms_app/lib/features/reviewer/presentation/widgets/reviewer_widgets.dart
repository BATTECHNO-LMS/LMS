import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';

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
    return StatusChip(label: label, color: statusColor(status));
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
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  ReviewerStatusChip(label: statusLabel, status: status),
                ],
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  subtitle!,
                  style: Theme.of(context).textTheme.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (metaChips.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    for (final chip in metaChips)
                      Text(chip, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Domain-switch filter row (chips), used instead of a desktop-style
/// `TabBar` so hub screens stay lightweight inside the shell.
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
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < labels.length; i++)
          ChoiceChip(
            label: Text(labels[i]),
            selected: selectedIndex == i,
            onSelected: (_) => onSelected(i),
          ),
      ],
    );
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
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  l10n.changeStatus,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              for (final option in options)
                ListTile(
                  title: Text(labelBuilder(option)),
                  onTap: () => Navigator.pop(ctx, option),
                ),
            ],
          ),
        ),
      );
    },
  );
}

/// Simple confirm/cancel bottom sheet with an optional free-text note field.
/// Returns the trimmed note text (possibly empty) if confirmed, or null if
/// cancelled — used for both plain confirmations and optional-reason flows.
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
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            if (body != null && body.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(body),
            ],
            if (withNoteField) ...[
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  labelText: noteLabel ?? l10n.adminNoteOptional,
                  border: const OutlineInputBorder(),
                ),
              ),
            ],
            const SizedBox(height: 12),
            PrimaryButton(
              label: l10n.continueAction,
              onPressed: () => Navigator.pop(ctx, noteCtrl.text.trim()),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(l10n.stayAndEdit),
            ),
          ],
        ),
      );
    },
  );
}
