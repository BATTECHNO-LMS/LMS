import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
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

  int get _presentCount =>
      _rows.where((r) => r.status == AttendanceStatus.present).length;

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
        backgroundColor: kInstructorPageBg,
        appBar: AppBar(
          title: Text(l10n.recordAttendance),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          foregroundColor: BatColors.heading,
          elevation: 0,
          leading: BackButton(
            onPressed: () async {
              if (await _confirmLeave() && context.mounted) context.pop();
            },
          ),
          actions: [
            TextButton(
              onPressed: _rows.isEmpty ? null : _markAllPresent,
              style: TextButton.styleFrom(
                foregroundColor: BatColors.primaryLight,
              ),
              child: Text(
                l10n.markAllPresent,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        body: SafeArea(child: _buildBody(l10n)),
        bottomNavigationBar: SafeArea(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE6E8EC))),
            ),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving || !_dirty ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: BatColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFE9EBEE),
                  disabledForegroundColor: const Color(0xFF8B93A0),
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
                        l10n.saveAttendance,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 5),
      );
    }
    if (_error != null && _rows.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    if (_rows.isEmpty) {
      return EmptyState(
        title: l10n.noParticipants,
        icon: Icons.groups_outlined,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      itemCount: _rows.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: InstSoftCard(
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
                      Icons.how_to_reg_outlined,
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
                          l10n.recordAttendance,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${l10n.attendance}: $_presentCount / ${_rows.length}',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: BatColors.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        final row = _rows[index - 1];
        final rowIndex = index - 1;
        final initial = row.studentName.isNotEmpty
            ? row.studentName.characters.first
            : '?';

        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: InstSoftCard(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                      child: Center(
                        child: Text(
                          initial,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: BatColors.primary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        row.studentName,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                AttendanceStatusSelector(
                  value: row.status,
                  onChanged: (status) {
                    setState(() {
                      _rows = [
                        for (var i = 0; i < _rows.length; i++)
                          if (i == rowIndex)
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
