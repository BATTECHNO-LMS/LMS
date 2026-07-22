import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../data/admin_repository.dart';

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
                  Text(
                    current == null ? l10n.recordHours : l10n.updateHours,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${l10n.completedHoursLabel}: ${current?.toString() ?? l10n.hoursNotRecorded}'
                    ' → ${l10n.requiredHoursLabel}: ${required?.toString() ?? l10n.hoursNotSpecified}',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: hoursCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.completedHoursLabel,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: noteCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: l10n.hoursNoteOptional,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  if (localError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      localError!,
                      style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: l10n.save,
                    isLoading: _saving,
                    onPressed: _saving
                        ? null
                        : () async {
                            final parsed = int.tryParse(hoursCtrl.text.trim());
                            if (parsed == null || parsed < 0) {
                              setModal(
                                () => localError = l10n.hoursValidationInvalid,
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.completedHoursLabel,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            _kv(
              l10n.requiredHoursLabel,
              required?.toString() ?? l10n.hoursNotSpecified,
            ),
            _kv(
              l10n.completedHoursLabel,
              completed?.toString() ?? l10n.hoursNotRecorded,
            ),
            _kv(l10n.remainingHoursLabel, remaining?.toString() ?? '—'),
            if (pct != null) _kv(l10n.hoursProgressLabel, '$pct%'),
            if (widget.canWrite) ...[
              const SizedBox(height: 12),
              PrimaryButton(
                label: completed == null ? l10n.recordHours : l10n.updateHours,
                onPressed: _openSheet,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
