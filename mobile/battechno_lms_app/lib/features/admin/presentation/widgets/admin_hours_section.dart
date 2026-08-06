import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/admin_repository.dart';
import 'admin_widgets.dart';

/// Aggregate hours summary + replace-total sheet (Model A). Both
/// `university_admin` and `academic_admin` can write via `/admin/field-training`.
class AdminHoursSection extends ConsumerStatefulWidget {
  const AdminHoursSection({
    super.key,
    required this.applicationId,
    required this.hours,
    required this.onUpdated,
    this.canWrite = true,
  });

  final String applicationId;
  final Map<String, dynamic> hours;
  final VoidCallback onUpdated;
  final bool canWrite;

  @override
  ConsumerState<AdminHoursSection> createState() => _AdminHoursSectionState();
}

class _AdminHoursSectionState extends ConsumerState<AdminHoursSection> {
  bool _saving = false;

  int? _asInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  Future<void> _openSheet() async {
    final l10n = AppLocalizations.of(context);
    final current = _asInt(widget.hours['completed_training_hours']);
    final required = _asInt(widget.hours['required_training_hours']);
    final hoursCtrl = TextEditingController(
      text: current != null ? '$current' : '',
    );
    final noteCtrl = TextEditingController();
    String? localError;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
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
                    current == null ? l10n.recordHours : l10n.updateHours,
                    style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.heading,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${l10n.completedHoursLabel}: ${current?.toString() ?? l10n.hoursNotRecorded}'
                    ' → ${l10n.requiredHoursLabel}: ${required?.toString() ?? l10n.hoursNotSpecified}',
                    style: Theme.of(
                      ctx,
                    ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: hoursCtrl,
                    keyboardType: TextInputType.number,
                    decoration: adminSoftFieldDecoration(
                      l10n.completedHoursLabel,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: noteCtrl,
                    maxLines: 2,
                    decoration: adminSoftFieldDecoration(
                      l10n.hoursNoteOptional,
                    ).copyWith(alignLabelWithHint: true),
                  ),
                  if (localError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      localError!,
                      style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _saving
                          ? null
                          : () async {
                              final parsed = int.tryParse(
                                hoursCtrl.text.trim(),
                              );
                              if (parsed == null || parsed < 0) {
                                setModal(
                                  () =>
                                      localError = l10n.hoursValidationInvalid,
                                );
                                return;
                              }
                              if (required != null && parsed > required) {
                                setModal(
                                  () => localError = l10n.hoursExceedRequired,
                                );
                                return;
                              }
                              setState(() => _saving = true);
                              setModal(() => localError = null);
                              try {
                                await ref
                                    .read(adminRepositoryProvider)
                                    .updateApplicationHours(
                                      applicationId: widget.applicationId,
                                      completedHours: parsed,
                                      note: noteCtrl.text,
                                      expectedCompletedHours: current,
                                    );
                                if (ctx.mounted) Navigator.pop(ctx);
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(l10n.hoursSaved)),
                                  );
                                  widget.onUpdated();
                                }
                              } on ApiException catch (e) {
                                final msg = e.statusCode == 409
                                    ? l10n.hoursConflict
                                    : e.statusCode == 403
                                    ? l10n.forbiddenAccess
                                    : e.statusCode == 422
                                    ? (e.code == 'HOURS_EXCEED_REQUIRED'
                                          ? l10n.hoursExceedRequired
                                          : l10n.validationError)
                                    : e.message;
                                setModal(() => localError = msg);
                                if (e.statusCode == 409) widget.onUpdated();
                              } finally {
                                if (mounted) setState(() => _saving = false);
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: BatColors.primary,
                        foregroundColor: Colors.white,
                        disabledBackgroundColor: BatColors.primary.withValues(
                          alpha: 0.5,
                        ),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _saving
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              l10n.save,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final required = _asInt(widget.hours['required_training_hours']);
    final completed = _asInt(widget.hours['completed_training_hours']);
    final remaining = _asInt(widget.hours['remaining_training_hours']);
    final pct = _asInt(widget.hours['hours_progress_percentage']);

    return AdminSoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.schedule_outlined,
                  color: BatColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.completedHoursLabel,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _HoursRow(
            label: l10n.requiredHoursLabel,
            value: required?.toString() ?? l10n.hoursNotSpecified,
          ),
          const SizedBox(height: 8),
          _HoursRow(
            label: l10n.completedHoursLabel,
            value: completed?.toString() ?? l10n.hoursNotRecorded,
          ),
          const SizedBox(height: 8),
          _HoursRow(
            label: l10n.remainingHoursLabel,
            value: remaining?.toString() ?? '—',
          ),
          if (pct != null) ...[
            const SizedBox(height: 8),
            _HoursRow(label: l10n.hoursProgressLabel, value: '$pct%'),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(BatRadii.pill),
              child: LinearProgressIndicator(
                value: (pct / 100).clamp(0, 1),
                minHeight: 8,
                color: BatColors.primary,
                backgroundColor: const Color(0xFFE6E8EC),
              ),
            ),
          ],
          if (widget.canWrite) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _openSheet,
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
                  completed == null ? l10n.recordHours : l10n.updateHours,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HoursRow extends StatelessWidget {
  const _HoursRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
          ),
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w800,
            color: BatColors.heading,
          ),
        ),
      ],
    );
  }
}
