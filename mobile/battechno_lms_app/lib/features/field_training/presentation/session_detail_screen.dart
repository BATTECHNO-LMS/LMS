import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../domain/session_models.dart';

class SessionDetailScreen extends StatelessWidget {
  const SessionDetailScreen({
    super.key,
    required this.opportunityId,
    required this.sessionId,
    this.initialSession,
  });

  final String opportunityId;
  final String sessionId;
  final Map<String, dynamic>? initialSession;

  TrainingSessionItem get _session =>
      TrainingSessionItem(raw: initialSession ?? {'id': sessionId});

  Future<void> _openMeetingLink(
    BuildContext context,
    AppLocalizations l10n,
  ) async {
    final url = _session.zoomLink;
    if (!SessionLabels.isSafeExternalUrl(url)) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.invalidMeetingLink)));
      return;
    }

    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.openMeetingLinkTitle),
        content: Text(l10n.openMeetingLinkBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.continueAction),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.openLink),
          ),
        ],
      ),
    );
    if (proceed != true || !context.mounted) return;

    final uri = Uri.parse(url!.trim());
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.invalidMeetingLink)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = _session;
    final timing = session.timing();

    if (initialSession == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.sessionDetails)),
        body: EmptyState(title: l10n.sessionNotFound),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.sessionDetails),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              session.title,
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            StatusChip(
              label: SessionLabels.timingAr(timing),
              color: timing == SessionTiming.upcoming
                  ? BatColors.accent
                  : BatColors.info,
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _row(l10n.trainingDates, session.sessionDate ?? '—'),
                    _row(
                      l10n.sessionTime,
                      '${session.startTime ?? '—'} – ${session.endTime ?? '—'}',
                    ),
                    _row(
                      l10n.sessionRequired,
                      session.isRequired ? l10n.yes : l10n.no,
                    ),
                    _row(
                      l10n.attendanceStatus,
                      SessionLabels.attendanceAr(session.attendanceStatus),
                    ),
                  ],
                ),
              ),
            ),
            if (session.description != null &&
                session.description!.isNotEmpty) ...[
              const SizedBox(height: 16),
              AcademicSectionHeader(title: l10n.description),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(session.description!),
                ),
              ),
            ],
            if (session.attendance?['note'] != null &&
                session.attendance!['note'].toString().isNotEmpty) ...[
              const SizedBox(height: 16),
              InfoBanner(message: session.attendance!['note'].toString()),
            ],
            const SizedBox(height: 16),
            if (SessionLabels.isSafeExternalUrl(session.zoomLink))
              PrimaryButton(
                label: l10n.joinSession,
                onPressed: () => _openMeetingLink(context, l10n),
              )
            else
              InfoBanner(message: l10n.noMeetingLink),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label)),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
