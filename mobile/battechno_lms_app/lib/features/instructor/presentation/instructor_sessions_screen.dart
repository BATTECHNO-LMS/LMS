import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';
import 'widgets/instructor_widgets.dart';

class InstructorSessionsScreen extends ConsumerStatefulWidget {
  const InstructorSessionsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<InstructorSessionsScreen> createState() =>
      _InstructorSessionsScreenState();
}

class _InstructorSessionsScreenState
    extends ConsumerState<InstructorSessionsScreen> {
  List<Map<String, dynamic>> _sessions = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final user = ref.read(authControllerProvider).user;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final sessions = await ref
          .read(instructorRepositoryProvider)
          .listSessions(widget.opportunityId, userId: user?.id);
      setState(() => _sessions = sessions);
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

  InputDecoration _fieldDecoration(String label, {String? hint}) {
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

  Future<void> _openForm({Map<String, dynamic>? existing}) async {
    final l10n = AppLocalizations.of(context);
    final titleCtrl = TextEditingController(
      text: existing?['title']?.toString() ?? '',
    );
    final dateCtrl = TextEditingController(
      text: existing?['session_date']?.toString().split('T').first ?? '',
    );
    final startCtrl = TextEditingController(
      text: _time(existing?['start_time']),
    );
    final endCtrl = TextEditingController(text: _time(existing?['end_time']));
    final linkCtrl = TextEditingController(
      text: existing?['zoom_link']?.toString() ?? '',
    );
    final descCtrl = TextEditingController(
      text: existing?['description']?.toString() ?? '',
    );
    var isRequired = existing?['is_required'] == true;
    var saving = false;

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
              child: SingleChildScrollView(
                child: Column(
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
                      existing == null ? l10n.createSession : l10n.editSession,
                      style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: titleCtrl,
                      decoration: _fieldDecoration(l10n.sessionTitle),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: dateCtrl,
                      decoration: _fieldDecoration(
                        l10n.sessionDate,
                        hint: 'YYYY-MM-DD',
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: startCtrl,
                            decoration: _fieldDecoration(
                              l10n.startTime,
                              hint: 'HH:MM',
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: endCtrl,
                            decoration: _fieldDecoration(
                              l10n.endTime,
                              hint: 'HH:MM',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: linkCtrl,
                      decoration: _fieldDecoration(l10n.meetingLink),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: descCtrl,
                      maxLines: 3,
                      decoration: _fieldDecoration(l10n.description),
                    ),
                    const SizedBox(height: 4),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        l10n.sessionRequired,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: BatColors.heading,
                        ),
                      ),
                      activeThumbColor: Colors.white,
                      activeTrackColor: BatColors.primary,
                      value: isRequired,
                      onChanged: (v) => setModal(() => isRequired = v),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: saving
                            ? null
                            : () async {
                                final title = titleCtrl.text.trim();
                                final date = dateCtrl.text.trim();
                                final start = startCtrl.text.trim();
                                final end = endCtrl.text.trim();
                                final link = linkCtrl.text.trim();
                                if (title.isEmpty ||
                                    date.isEmpty ||
                                    start.isEmpty ||
                                    end.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(l10n.validationError),
                                    ),
                                  );
                                  return;
                                }
                                if (!InstructorLabels.isEndAfterStart(
                                  start,
                                  end,
                                )) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(l10n.invalidSessionTimes),
                                    ),
                                  );
                                  return;
                                }
                                if (link.isNotEmpty &&
                                    !InstructorLabels.isSafeHttpsUrl(link)) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(l10n.invalidMeetingUrl),
                                    ),
                                  );
                                  return;
                                }
                                setModal(() => saving = true);
                                try {
                                  final body = {
                                    'title': title,
                                    'session_date': date,
                                    'start_time': start,
                                    'end_time': end,
                                    'description': descCtrl.text.trim().isEmpty
                                        ? null
                                        : descCtrl.text.trim(),
                                    'zoom_link': link.isEmpty ? null : link,
                                    'is_required': isRequired,
                                  };
                                  if (existing == null) {
                                    await ref
                                        .read(instructorRepositoryProvider)
                                        .createSession(
                                          opportunityId: widget.opportunityId,
                                          body: body,
                                        );
                                  } else {
                                    await ref
                                        .read(instructorRepositoryProvider)
                                        .updateSession(
                                          sessionId: existing['id'].toString(),
                                          body: body,
                                        );
                                  }
                                  if (ctx.mounted) Navigator.pop(ctx);
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(l10n.sessionSaved),
                                      ),
                                    );
                                    await _load();
                                  }
                                } on ApiException catch (e) {
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(_mapWriteError(e, l10n)),
                                      ),
                                    );
                                  }
                                } finally {
                                  setModal(() => saving = false);
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
                        child: saving
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
              ),
            );
          },
        );
      },
    );
  }

  String _time(dynamic value) {
    final s = value?.toString() ?? '';
    if (s.length >= 5) return s.substring(0, 5);
    return s;
  }

  String _mapWriteError(ApiException e, AppLocalizations l10n) {
    if (e.statusCode == 403) return l10n.forbiddenAccess;
    if (e.statusCode == 404) return l10n.resourceNotFound;
    if (e.statusCode == 409) return l10n.conflictError;
    if (e.statusCode == 422) return l10n.validationError;
    return e.message;
  }

  void _openAttendance(Map<String, dynamic> session) {
    final sid = session['id']?.toString();
    if (sid == null) return;
    context.push(
      '/instructor/field-training/${widget.opportunityId}/sessions/$sid/attendance',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kInstructorPageBg,
      appBar: AppBar(
        title: Text(l10n.trainingSessions),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: BatColors.primary,
        foregroundColor: Colors.white,
        elevation: 2,
        icon: const Icon(Icons.add),
        label: Text(
          l10n.createSession,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading && _sessions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error != null && _sessions.isEmpty) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
        children: [
          InstSoftCard(
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
                    Icons.event_available_outlined,
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
                        l10n.trainingSessions,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.viewSessions,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: BatColors.accentSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_sessions.length}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: BatColors.accentHover,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_sessions.isEmpty)
            EmptyState(title: l10n.noSessions, icon: Icons.event_outlined)
          else
            for (final session in _sessions)
              _SessionCard(
                title: session['title']?.toString() ?? '—',
                subtitle:
                    '${session['session_date']?.toString().split('T').first ?? ''} · ${_time(session['start_time'])}–${_time(session['end_time'])}',
                required: session['is_required'] == true,
                requiredLabel: l10n.sessionRequired,
                attendanceLabel: l10n.recordAttendance,
                editLabel: l10n.editSession,
                onTap: () => _openAttendance(session),
                onAttendance: () => _openAttendance(session),
                onEdit: () => _openForm(existing: session),
              ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.title,
    required this.subtitle,
    required this.required,
    required this.requiredLabel,
    required this.attendanceLabel,
    required this.editLabel,
    required this.onTap,
    required this.onAttendance,
    required this.onEdit,
  });

  final String title;
  final String subtitle;
  final bool required;
  final String requiredLabel;
  final String attendanceLabel;
  final String editLabel;
  final VoidCallback onTap;
  final VoidCallback onAttendance;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return InstSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 8, 14),
      child: Row(
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
              Icons.event_outlined,
              color: BatColors.primary,
              size: 22,
            ),
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
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
                if (required) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: BatColors.accentSoft,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      requiredLabel,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: BatColors.accentHover,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: BatColors.muted),
            onSelected: (v) {
              if (v == 'edit') onEdit();
              if (v == 'attendance') onAttendance();
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'attendance', child: Text(attendanceLabel)),
              PopupMenuItem(value: 'edit', child: Text(editLabel)),
            ],
          ),
        ],
      ),
    );
  }
}
