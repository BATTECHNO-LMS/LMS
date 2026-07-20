import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/assessment_models.dart';
import '../../domain/field_training_models.dart';
import '../../domain/session_models.dart';

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
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(BatRadii.lg),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      session.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  StatusChip(
                    label: SessionLabels.timingAr(timing),
                    color: timing == SessionTiming.upcoming
                        ? BatColors.accent
                        : timing == SessionTiming.ongoing
                        ? BatColors.success
                        : BatColors.muted,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _dateLine(),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
              ),
              const SizedBox(height: 8),
              StatusChip(
                label: SessionLabels.attendanceAr(session.attendanceStatus),
                color: session.attendanceStatus == AttendanceStatus.present
                    ? BatColors.success
                    : BatColors.info,
              ),
            ],
          ),
        ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
                    ),
                  ),
                ),
                if (onViewSessions != null)
                  TextButton(
                    onPressed: onViewSessions,
                    child: Text(l10n.viewAllSessions),
                  ),
              ],
            ),
            if (percentage != null) ...[
              const SizedBox(height: 8),
              Text(
                l10n.attendancePercentageLabel(percentage!),
                style: const TextStyle(fontWeight: FontWeight.w700),
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
        AcademicSectionHeader(title: l10n.trainingJourney),
        const SizedBox(height: 8),
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
          InfoBanner(message: nextAction!['label_ar'].toString()),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: onOpenAssessments,
          child: Text(l10n.viewAssessments),
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
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: BatColors.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_left),
        onTap: onTap,
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
