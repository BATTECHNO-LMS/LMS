import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';

/// Read-only sessions list with an attendance-summary drill sheet.
class AdminSessionsScreen extends ConsumerStatefulWidget {
  const AdminSessionsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<AdminSessionsScreen> createState() =>
      _AdminSessionsScreenState();
}

class _AdminSessionsScreenState extends ConsumerState<AdminSessionsScreen> {
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
          .read(adminRepositoryProvider)
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

  String _time(dynamic value) {
    final s = value?.toString() ?? '';
    return s.length >= 5 ? s.substring(0, 5) : s;
  }

  Future<void> _showAttendance(Map<String, dynamic> session) async {
    final l10n = AppLocalizations.of(context);
    final sessionId = session['id']?.toString();
    if (sessionId == null) return;
    List<Map<String, dynamic>> participants = const [];
    String? error;
    try {
      participants = await ref
          .read(adminRepositoryProvider)
          .getAttendance(sessionId);
    } on ApiException catch (e) {
      error = e.statusCode == 403 ? l10n.forbiddenAccess : e.message;
    } catch (_) {
      error = l10n.networkErrorBody;
    }
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: SizedBox(
            height: MediaQuery.of(ctx).size.height * 0.6,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  session['title']?.toString() ?? l10n.attendance,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 12),
                if (error != null)
                  Text(
                    error,
                    style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                  )
                else if (participants.isEmpty)
                  EmptyState(title: l10n.noParticipants, subtitle: '')
                else
                  Expanded(
                    child: ListView(
                      children: [
                        for (final p in participants)
                          ListTile(
                            title: Text(p['student_name']?.toString() ?? '—'),
                            trailing: Text(
                              AdminLabels.statusAr(
                                p['attendance'] is Map
                                    ? (p['attendance'] as Map)['status']
                                          ?.toString()
                                    : null,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.trainingSessions)),
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
                            '${session['session_date']?.toString().split('T').first ?? ''} · '
                            '${_time(session['start_time'])}–${_time(session['end_time'])}',
                          ),
                          trailing: const Icon(Icons.how_to_reg_outlined),
                          onTap: () => _showAttendance(session),
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
