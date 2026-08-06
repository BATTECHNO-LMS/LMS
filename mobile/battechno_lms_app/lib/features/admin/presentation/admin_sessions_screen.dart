import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../../auth/providers/auth_controller.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';
import 'widgets/admin_widgets.dart';

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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: SizedBox(
            height: MediaQuery.of(ctx).size.height * 0.6,
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
                  session['title']?.toString() ?? l10n.attendance,
                  style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.attendance,
                  style: Theme.of(
                    ctx,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
                const SizedBox(height: 14),
                if (error != null)
                  Text(
                    error,
                    style: TextStyle(color: Theme.of(ctx).colorScheme.error),
                  )
                else if (participants.isEmpty)
                  Expanded(
                    child: Center(
                      child: EmptyState(
                        title: l10n.noParticipants,
                        subtitle: '',
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView(
                      children: [
                        for (final p in participants)
                          AdminSoftCard(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: BatColors.primarySoft,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                    Icons.person_outline,
                                    color: BatColors.primary,
                                    size: 18,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    p['student_name']?.toString() ?? '—',
                                    style: Theme.of(ctx).textTheme.bodyMedium
                                        ?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          color: BatColors.heading,
                                        ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: BatColors.primarySoft,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    AdminLabels.statusAr(
                                      p['attendance'] is Map
                                          ? (p['attendance'] as Map)['status']
                                                ?.toString()
                                          : null,
                                    ),
                                    style: Theme.of(ctx).textTheme.labelSmall
                                        ?.copyWith(
                                          color: BatColors.primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                ),
                              ],
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
      backgroundColor: kAdminPageBg,
      appBar: AppBar(
        title: Text(l10n.trainingSessions),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
      ),
      body: SafeArea(
        child: _loading && _sessions.isEmpty
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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  children: [
                    if (_sessions.isEmpty)
                      EmptyState(title: l10n.noSessions, subtitle: '')
                    else
                      for (final session in _sessions)
                        _AdminSessionCard(
                          title: session['title']?.toString() ?? '—',
                          subtitle:
                              '${session['session_date']?.toString().split('T').first ?? ''} · '
                              '${_time(session['start_time'])}–${_time(session['end_time'])}',
                          onTap: () => _showAttendance(session),
                        ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _AdminSessionCard extends StatelessWidget {
  const _AdminSessionCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AdminSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
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
              ],
            ),
          ),
          const Icon(Icons.how_to_reg_outlined, color: BatColors.muted),
        ],
      ),
    );
  }
}
