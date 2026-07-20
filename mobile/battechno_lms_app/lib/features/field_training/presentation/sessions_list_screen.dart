import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/session_models.dart';
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
      appBar: AppBar(
        title: Text(l10n.trainingSessions),
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

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (upcoming.isNotEmpty) ...[
            AcademicSectionHeader(title: l10n.upcomingSessions),
            const SizedBox(height: 8),
            for (final session in upcoming)
              SessionCard(
                session: session,
                l10n: l10n,
                onTap: () => _openSession(session),
              ),
          ],
          if (past.isNotEmpty) ...[
            const SizedBox(height: 8),
            AcademicSectionHeader(title: l10n.pastSessions),
            const SizedBox(height: 8),
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
