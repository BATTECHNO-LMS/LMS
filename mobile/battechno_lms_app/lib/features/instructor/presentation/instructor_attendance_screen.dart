import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorAttendanceScreen extends ConsumerStatefulWidget {
  const InstructorAttendanceScreen({
    super.key,
    required this.opportunityId,
    required this.sessionId,
  });

  final String opportunityId;
  final String sessionId;

  @override
  ConsumerState<InstructorAttendanceScreen> createState() =>
      _InstructorAttendanceScreenState();
}

class _InstructorAttendanceScreenState
    extends ConsumerState<InstructorAttendanceScreen> {
  List<_AttendanceRow> _rows = const [];
  bool _loading = true;
  bool _saving = false;
  String? _error;
  bool _dirty = false;

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
      final participants = await ref
          .read(instructorRepositoryProvider)
          .getAttendanceParticipants(widget.sessionId);
      setState(() {
        _rows = participants.map(_AttendanceRow.fromParticipant).toList();
        _dirty = false;
      });
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

  Future<bool> _confirmLeave() async {
    if (!_dirty) return true;
    final l10n = AppLocalizations.of(context);
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.unsavedAttendanceTitle),
        content: Text(l10n.unsavedAttendanceBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.stayAndEdit),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.leaveWithoutSaving),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context);
    final recorded = _rows.where((r) => r.status.isRecorded).toList();
    if (recorded.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.validationError)));
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.confirmAttendanceSave),
        content: Text(l10n.confirmAttendanceSaveBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.discardChanges),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.saveAttendance),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _saving = true);
    try {
      await ref
          .read(instructorRepositoryProvider)
          .saveAttendance(
            sessionId: widget.sessionId,
            records: recorded
                .map(
                  (r) => {
                    'applicationId': r.applicationId,
                    'studentId': r.studentId,
                    'status': r.status.apiValue,
                  },
                )
                .toList(),
          );
      if (!mounted) return;
      setState(() => _dirty = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.attendanceSaved)));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      final msg = e.statusCode == 403
          ? l10n.forbiddenAccess
          : e.statusCode == 409
          ? l10n.conflictError
          : e.statusCode == 422
          ? l10n.validationError
          : l10n.attendanceSaveFailed;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _markAllPresent() {
    setState(() {
      _rows = [
        for (final r in _rows) r.copyWith(status: AttendanceStatus.present),
      ];
      _dirty = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        final leave = await _confirmLeave();
        if (leave && mounted) navigator.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(l10n.recordAttendance),
          actions: [
            TextButton(
              onPressed: _rows.isEmpty ? null : _markAllPresent,
              child: Text(l10n.markAllPresent),
            ),
          ],
        ),
        body: _loading
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: LoadingSkeleton(lines: 5),
              )
            : _error != null && _rows.isEmpty
            ? RetryView(
                title: l10n.networkErrorTitle,
                message: _error == 'forbidden'
                    ? l10n.forbiddenAccess
                    : l10n.networkErrorBody,
                onRetry: _load,
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _rows.length,
                itemBuilder: (context, index) {
                  final row = _rows[index];
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row.studentName,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          AttendanceStatusSelector(
                            value: row.status,
                            onChanged: (status) {
                              setState(() {
                                _rows = [
                                  for (var i = 0; i < _rows.length; i++)
                                    if (i == index)
                                      row.copyWith(status: status)
                                    else
                                      _rows[i],
                                ];
                                _dirty = true;
                              });
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: PrimaryButton(
              label: l10n.saveAttendance,
              onPressed: _saving || !_dirty ? null : _save,
            ),
          ),
        ),
      ),
    );
  }
}

class _AttendanceRow {
  const _AttendanceRow({
    required this.applicationId,
    required this.studentId,
    required this.studentName,
    required this.status,
  });

  final String applicationId;
  final String studentId;
  final String studentName;
  final AttendanceStatus status;

  _AttendanceRow copyWith({AttendanceStatus? status}) {
    return _AttendanceRow(
      applicationId: applicationId,
      studentId: studentId,
      studentName: studentName,
      status: status ?? this.status,
    );
  }

  factory _AttendanceRow.fromParticipant(Map<String, dynamic> map) {
    final attendance = map['attendance'];
    String? status;
    if (attendance is Map) {
      status = attendance['status']?.toString();
    }
    status ??= map['attendance_status']?.toString();
    return _AttendanceRow(
      applicationId:
          map['application_id']?.toString() ?? map['id']?.toString() ?? '',
      studentId:
          map['student_id']?.toString() ??
          (map['student'] is Map
              ? (map['student'] as Map)['id']?.toString()
              : null) ??
          '',
      studentName:
          map['student_name']?.toString() ??
          (map['student'] is Map
              ? (map['student'] as Map)['full_name']?.toString()
              : null) ??
          '—',
      status: AttendanceStatus.fromApi(status),
    );
  }
}
