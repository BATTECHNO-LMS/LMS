import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/session_models.dart';
import 'widgets/field_training_widgets.dart';
import 'widgets/session_widgets.dart';

class SessionsListScreen extends ConsumerStatefulWidget {
  const SessionsListScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<SessionsListScreen> createState() => _SessionsListScreenState();
}

class _SessionsListScreenState extends ConsumerState<SessionsListScreen> {
  List<TrainingSessionItem> _sessions = const [];
  bool _loading = true;
  String? _error;

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
      final sessions = await ref
          .read(fieldTrainingRepositoryProvider)
          .loadSessions(widget.opportunityId);
      setState(() => _sessions = sessions);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<TrainingSessionItem> _sorted(List<TrainingSessionItem> items) {
    final copy = List<TrainingSessionItem>.from(items);
    copy.sort((a, b) => (a.sessionDate ?? '').compareTo(b.sessionDate ?? ''));
    return copy;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kFtPageBg,
      appBar: AppBar(
        title: Text(l10n.trainingSessions),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (_error != null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error!,
        onRetry: _load,
      );
    }
    if (_sessions.isEmpty) {
      return EmptyState(
        title: l10n.noSessionsCurrently,
        icon: Icons.event_outlined,
      );
    }

    final upcoming = _sorted(
      _sessions.where((s) => s.timing() != SessionTiming.past).toList(),
    );
    final past = _sorted(
      _sessions.where((s) => s.timing() == SessionTiming.past).toList(),
    );
    final presentCount = _sessions
        .where((s) => s.attendanceStatus == AttendanceStatus.present)
        .length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          FtSoftCard(
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
                        l10n.sessionsAttendedLabel(
                          presentCount,
                          _sessions.length,
                        ),
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
          if (upcoming.isNotEmpty) ...[
            const SizedBox(height: 18),
            _SectionLabel(title: l10n.upcomingSessions, count: upcoming.length),
            const SizedBox(height: 10),
            for (final session in upcoming)
              SessionCard(
                session: session,
                l10n: l10n,
                onTap: () => _openSession(session),
              ),
          ],
          if (past.isNotEmpty) ...[
            const SizedBox(height: 14),
            _SectionLabel(title: l10n.pastSessions, count: past.length),
            const SizedBox(height: 10),
            for (final session in past)
              SessionCard(
                session: session,
                l10n: l10n,
                onTap: () => _openSession(session),
              ),
          ],
        ],
      ),
    );
  }

  void _openSession(TrainingSessionItem session) {
    context.push(
      '/student/field-training/${widget.opportunityId}/sessions/${session.id}',
      extra: session.raw,
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
        ),
        Text(
          '$count',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: BatColors.muted,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
