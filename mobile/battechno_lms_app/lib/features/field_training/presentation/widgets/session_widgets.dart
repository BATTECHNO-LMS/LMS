import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/assessment_models.dart';
import '../../domain/field_training_models.dart';
import '../../domain/session_models.dart';
import 'field_training_widgets.dart';

class SessionCard extends StatelessWidget {
  const SessionCard({
    super.key,
    required this.session,
    required this.l10n,
    required this.onTap,
  });

  final TrainingSessionItem session;
  final AppLocalizations l10n;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final timing = session.timing();
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

    return FtSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                child: Text(
                  session.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
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
                  color: timingBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  SessionLabels.timingAr(timing),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: timingColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _dateLine(),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: present
                  ? BatColors.success.withValues(alpha: 0.12)
                  : const Color(0xFFEEF0F3),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              SessionLabels.attendanceAr(session.attendanceStatus),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: present
                    ? BatColors.successText
                    : const Color(0xFF8B93A0),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _dateLine() {
    final date = session.sessionDate ?? '—';
    final start = session.startTime ?? '';
    final end = session.endTime ?? '';
    if (start.isEmpty) return date;
    return '$date · $start${end.isNotEmpty ? '–$end' : ''}';
  }
}

class AttendanceSummaryCard extends StatelessWidget {
  const AttendanceSummaryCard({
    super.key,
    required this.l10n,
    this.percentage,
    this.sessionsAttended,
    this.requiredCount,
    this.onViewSessions,
  });

  final AppLocalizations l10n;
  final int? percentage;
  final int? sessionsAttended;
  final int? requiredCount;
  final VoidCallback? onViewSessions;

  @override
  Widget build(BuildContext context) {
    return FtSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.attendanceSummary,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
              ),
              if (onViewSessions != null)
                TextButton(
                  onPressed: onViewSessions,
                  style: TextButton.styleFrom(
                    foregroundColor: BatColors.primaryLight,
                  ),
                  child: Text(l10n.viewAllSessions),
                ),
            ],
          ),
          if (percentage != null) ...[
            const SizedBox(height: 8),
            Text(
              l10n.attendancePercentageLabel(percentage!),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
          ],
          if (sessionsAttended != null && requiredCount != null) ...[
            const SizedBox(height: 4),
            Text(
              l10n.sessionsAttendedLabel(sessionsAttended!, requiredCount!),
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
          ],
          if (percentage == null &&
              sessionsAttended == null &&
              requiredCount == null)
            Text(
              l10n.attendanceSummaryUnavailable,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
        ],
      ),
    );
  }
}

class FieldTrainingJourneySection extends StatelessWidget {
  const FieldTrainingJourneySection({
    super.key,
    required this.l10n,
    required this.opportunityId,
    required this.opportunity,
    required this.progress,
    required this.assessments,
    required this.sessions,
    required this.onOpenAssessments,
    required this.onOpenAssessment,
    required this.onOpenSessions,
    required this.onOpenSession,
  });

  final AppLocalizations l10n;
  final String opportunityId;
  final Map<String, dynamic> opportunity;
  final Map<String, dynamic>? progress;
  final List<StudentAssessmentSummary> assessments;
  final List<TrainingSessionItem> sessions;
  final VoidCallback onOpenAssessments;
  final void Function(String type) onOpenAssessment;
  final VoidCallback onOpenSessions;
  final void Function(TrainingSessionItem session) onOpenSession;

  @override
  Widget build(BuildContext context) {
    final requiresPre = opportunity['requires_pre_assessment'] != false;
    final requiresPost = opportunity['requires_post_assessment'] != false;
    final pre = _firstOfType(assessments, 'pre');
    final post = _firstOfType(assessments, 'post');
    final metrics = JsonHelpers.map(progress?['metrics']) ?? {};
    final nextAction = JsonHelpers.map(progress?['next_action']);

    final upcoming =
        sessions.where((s) => s.timing() != SessionTiming.past).toList()..sort(
          (a, b) => (a.sessionDate ?? '').compareTo(b.sessionDate ?? ''),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.trainingJourney,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: BatColors.heading,
          ),
        ),
        const SizedBox(height: 10),
        if (requiresPre)
          _compactTile(
            context,
            icon: Icons.quiz_outlined,
            title: l10n.preAssessment,
            subtitle: _assessmentSubtitle(pre),
            onTap: () => onOpenAssessment('pre'),
          ),
        if (upcoming.isNotEmpty)
          _compactTile(
            context,
            icon: Icons.event_outlined,
            title: l10n.upcomingSession,
            subtitle: upcoming.first.title,
            onTap: () => onOpenSession(upcoming.first),
          ),
        AttendanceSummaryCard(
          l10n: l10n,
          percentage: JsonHelpers.integer(metrics, ['attendance_percentage']),
          sessionsAttended: JsonHelpers.integer(metrics, ['sessions_attended']),
          requiredCount: JsonHelpers.integer(metrics, [
            'required_sessions_count',
          ]),
          onViewSessions: onOpenSessions,
        ),
        if (requiresPost)
          _compactTile(
            context,
            icon: Icons.assignment_turned_in_outlined,
            title: l10n.postAssessment,
            subtitle: _assessmentSubtitle(post),
            onTap: () => onOpenAssessment('post'),
          ),
        if (nextAction?['label_ar'] != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InfoBanner(message: nextAction!['label_ar'].toString()),
          ),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: onOpenAssessments,
            style: FilledButton.styleFrom(
              backgroundColor: BatColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              l10n.viewAssessments,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
      ],
    );
  }

  Widget _compactTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return FtSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: BatColors.primary, size: 22),
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
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
      ),
    );
  }

  String _assessmentSubtitle(StudentAssessmentSummary? item) {
    if (item == null) return l10n.assessmentNotPublished;
    if (item.isSubmitted) {
      return item.score != null
          ? l10n.assessmentScoreLabel(item.score!)
          : l10n.assessmentCompleted;
    }
    if (item.canTake) return l10n.assessmentAvailable;
    return l10n.assessmentLocked;
  }

  StudentAssessmentSummary? _firstOfType(
    List<StudentAssessmentSummary> items,
    String type,
  ) {
    for (final item in items) {
      if (item.type == type) return item;
    }
    return null;
  }
}
