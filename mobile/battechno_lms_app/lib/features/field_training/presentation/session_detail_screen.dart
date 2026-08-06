import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../domain/session_models.dart';
import 'widgets/field_training_widgets.dart';

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
        backgroundColor: kFtPageBg,
        appBar: AppBar(
          title: Text(l10n.sessionDetails),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          foregroundColor: BatColors.heading,
          elevation: 0,
          leading: BackButton(onPressed: () => context.pop()),
        ),
        body: EmptyState(title: l10n.sessionNotFound),
      );
    }

    final present = session.attendanceStatus == AttendanceStatus.present;
    final timingColor = timing == SessionTiming.upcoming
        ? BatColors.accentHover
        : timing == SessionTiming.ongoing
        ? BatColors.successText
        : const Color(0xFF8B93A0);
    final timingBg = timing == SessionTiming.upcoming
        ? BatColors.accentSoft
        : timing == SessionTiming.ongoing
        ? BatColors.success.withValues(alpha: 0.12)
        : const Color(0xFFEEF0F3);

    return Scaffold(
      backgroundColor: kFtPageBg,
      appBar: AppBar(
        title: Text(l10n.sessionDetails),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          children: [
            FtSoftCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: BatColors.primarySoft,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.event_outlined,
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
                          session.title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                                height: 1.25,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: timingBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            SessionLabels.timingAr(timing),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: timingColor,
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
            const SizedBox(height: 12),
            FtSoftCard(
              child: Column(
                children: [
                  _InfoRow(
                    icon: Icons.calendar_today_outlined,
                    label: l10n.trainingDates,
                    value: session.sessionDate ?? '—',
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    icon: Icons.schedule_outlined,
                    label: l10n.sessionTime,
                    value:
                        '${session.startTime ?? '—'} – ${session.endTime ?? '—'}',
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    icon: Icons.flag_outlined,
                    label: l10n.sessionRequired,
                    value: session.isRequired ? l10n.yes : l10n.no,
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    icon: Icons.how_to_reg_outlined,
                    label: l10n.attendanceStatus,
                    value: SessionLabels.attendanceAr(session.attendanceStatus),
                    valueColor: present
                        ? BatColors.successText
                        : BatColors.heading,
                  ),
                ],
              ),
            ),
            if (session.description != null &&
                session.description!.isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(
                l10n.description,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 10),
              FtSoftCard(
                child: Text(
                  session.description!,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: BatColors.heading,
                    height: 1.45,
                  ),
                ),
              ),
            ],
            if (session.attendance?['note'] != null &&
                session.attendance!['note'].toString().isNotEmpty) ...[
              const SizedBox(height: 12),
              FtSoftCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: BatColors.accentSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.sticky_note_2_outlined,
                        color: BatColors.accentHover,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        session.attendance!['note'].toString(),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.heading,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 18),
            if (SessionLabels.isSafeExternalUrl(session.zoomLink))
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _openMeetingLink(context, l10n),
                  icon: const Icon(Icons.videocam_outlined, size: 20),
                  label: Text(
                    l10n.joinSession,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: BatColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              )
            else
              FtSoftCard(
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF0F3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.link_off_outlined,
                        color: Color(0xFF8B93A0),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        l10n.noMeetingLink,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: BatColors.muted,
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
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: BatColors.primaryLight),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: valueColor ?? BatColors.heading,
            ),
          ),
        ),
      ],
    );
  }
}
