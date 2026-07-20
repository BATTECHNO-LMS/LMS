import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/instructor_repository.dart';
import '../domain/instructor_models.dart';

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
                    Text(
                      existing == null ? l10n.createSession : l10n.editSession,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: titleCtrl,
                      decoration: InputDecoration(labelText: l10n.sessionTitle),
                    ),
                    TextField(
                      controller: dateCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.sessionDate,
                        hintText: 'YYYY-MM-DD',
                      ),
                    ),
                    TextField(
                      controller: startCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.startTime,
                        hintText: 'HH:MM',
                      ),
                    ),
                    TextField(
                      controller: endCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.endTime,
                        hintText: 'HH:MM',
                      ),
                    ),
                    TextField(
                      controller: linkCtrl,
                      decoration: InputDecoration(labelText: l10n.meetingLink),
                    ),
                    TextField(
                      controller: descCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(labelText: l10n.description),
                    ),
                    SwitchListTile(
                      title: Text(l10n.sessionRequired),
                      value: isRequired,
                      onChanged: (v) => setModal(() => isRequired = v),
                    ),
                    const SizedBox(height: 8),
                    PrimaryButton(
                      label: l10n.save,
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
                                  SnackBar(content: Text(l10n.validationError)),
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
                                    SnackBar(content: Text(l10n.sessionSaved)),
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.trainingSessions)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add),
        label: Text(l10n.createSession),
      ),
      body: _loading && _sessions.isEmpty
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 4),
            )
          : _error != null && _sessions.isEmpty
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
                  if (_sessions.isEmpty)
                    EmptyState(title: l10n.noSessions, subtitle: '')
                  else
                    for (final session in _sessions) ...[
                      Card(
                        child: ListTile(
                          title: Text(
                            session['title']?.toString() ?? '—',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            '${session['session_date']?.toString().split('T').first ?? ''} · ${_time(session['start_time'])}–${_time(session['end_time'])}',
                          ),
                          trailing: PopupMenuButton<String>(
                            onSelected: (v) {
                              if (v == 'edit') _openForm(existing: session);
                              if (v == 'attendance') {
                                final sid = session['id']?.toString();
                                if (sid != null) {
                                  context.push(
                                    '/instructor/field-training/${widget.opportunityId}/sessions/$sid/attendance',
                                  );
                                }
                              }
                            },
                            itemBuilder: (_) => [
                              PopupMenuItem(
                                value: 'attendance',
                                child: Text(l10n.recordAttendance),
                              ),
                              PopupMenuItem(
                                value: 'edit',
                                child: Text(l10n.editSession),
                              ),
                            ],
                          ),
                          onTap: () {
                            final sid = session['id']?.toString();
                            if (sid == null) return;
                            context.push(
                              '/instructor/field-training/${widget.opportunityId}/sessions/$sid/attendance',
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }
}
