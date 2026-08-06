import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../domain/instructor_models.dart';

const Color kInstructorPageBg = Color(0xFFF2F3F5);

class InstSoftCard extends StatelessWidget {
  const InstSoftCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(22);
    final content = Padding(padding: padding, child: child);
    return Padding(
      padding: margin,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: radius,
          border: Border.all(color: const Color(0xFFE6E8EC)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1A2330).withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: onTap == null
            ? content
            : Material(
                color: Colors.transparent,
                borderRadius: radius,
                child: InkWell(
                  onTap: onTap,
                  borderRadius: radius,
                  child: content,
                ),
              ),
      ),
    );
  }
}

class InstructorPriorityCard extends StatelessWidget {
  const InstructorPriorityCard({
    super.key,
    required this.action,
    required this.onTap,
  });

  final InstructorPriorityAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (title, subtitle, icon) = _copy(l10n);
    return InstSoftCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: BatColors.accentSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: BatColors.accentHover, size: 24),
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
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: BatColors.muted,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_left, color: BatColors.muted),
        ],
      ),
    );
  }

  (String, String, IconData) _copy(AppLocalizations l10n) {
    switch (action.type) {
      case InstructorPriorityType.reviewSubmissions:
        return (
          l10n.instructorPriorityReviewSubmissions(action.count ?? 0),
          action.title,
          Icons.assignment_turned_in_outlined,
        );
      case InstructorPriorityType.upcomingSession:
        return (
          l10n.instructorPriorityUpcomingSession,
          action.title,
          Icons.event_outlined,
        );
      case InstructorPriorityType.recordAttendance:
        return (
          l10n.instructorPriorityRecordAttendance,
          action.title,
          Icons.how_to_reg_outlined,
        );
      case InstructorPriorityType.followUpStudents:
        return (
          l10n.instructorPriorityFollowUp(action.count ?? 0),
          action.title,
          Icons.warning_amber_outlined,
        );
      case InstructorPriorityType.openTraining:
        return (
          l10n.instructorPriorityOpenTraining,
          action.title,
          Icons.hiking_outlined,
        );
    }
  }
}

class AssignedTrainingCard extends StatelessWidget {
  const AssignedTrainingCard({
    super.key,
    required this.opportunity,
    required this.onTap,
  });

  final InstructorOpportunity opportunity;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return InstSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.hiking_outlined,
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
                      opportunity.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                        height: 1.25,
                      ),
                    ),
                    if (opportunity.specialtyName != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        opportunity.specialtyName!,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
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
                  InstructorLabels.statusAr(opportunity.status),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: BatColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${InstructorLabels.modeAr(opportunity.trainingMode)}'
            '${opportunity.startDate != null ? ' · ${opportunity.startDate}' : ''}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaChip(
                icon: Icons.groups_outlined,
                text: '${opportunity.participantsCount} ${l10n.students}',
              ),
              _MetaChip(
                icon: Icons.event_outlined,
                text: '${opportunity.sessionsCount} ${l10n.sessions}',
              ),
              if (opportunity.pendingSubmissionsCount > 0)
                _MetaChip(
                  icon: Icons.assignment_late_outlined,
                  text: l10n.pendingSubmissionsCount(
                    opportunity.pendingSubmissionsCount,
                  ),
                  accent: true,
                ),
              _MetaChip(
                icon: Icons.schedule_outlined,
                text: opportunity.requiredHours != null
                    ? '${opportunity.requiredHours} ${l10n.hours}'
                    : l10n.hoursNotSpecified,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.text,
    this.accent = false,
  });

  final IconData icon;
  final String text;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: accent ? BatColors.accentSoft : const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: accent ? BatColors.accentHover : BatColors.primaryLight,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: accent ? BatColors.accentHover : BatColors.heading,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class ParticipantProgressCard extends StatelessWidget {
  const ParticipantProgressCard({
    super.key,
    required this.application,
    required this.onTap,
  });

  final Map<String, dynamic> application;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final name =
        application['student_name']?.toString() ??
        application['full_name']?.toString() ??
        '—';
    final trainingStatus =
        application['training_status']?.toString() ??
        application['status']?.toString() ??
        '';
    final attendance = application['attendance_percentage'];
    final attendanceLabel = attendance != null
        ? '${attendance is num ? attendance.toStringAsFixed(0) : attendance}%'
        : '—';

    return InstSoftCard(
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
            child: Center(
              child: Text(
                name.isNotEmpty ? name.characters.first : '?',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: BatColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${InstructorLabels.statusAr(trainingStatus)} · ${l10n.attendance}: $attendanceLabel',
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
}

class AttendanceStatusSelector extends StatelessWidget {
  const AttendanceStatusSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final AttendanceStatus value;
  final ValueChanged<AttendanceStatus> onChanged;

  @override
  Widget build(BuildContext context) {
    final options = [
      AttendanceStatus.present,
      AttendanceStatus.absent,
      AttendanceStatus.late,
      AttendanceStatus.excused,
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final status in options)
          GestureDetector(
            onTap: () => onChanged(status),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: value == status
                    ? BatColors.primary
                    : const Color(0xFFF7F8FA),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: value == status
                      ? BatColors.primary
                      : const Color(0xFFE6E8EC),
                ),
              ),
              child: Text(
                InstructorLabels.attendanceAr(status),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: value == status ? Colors.white : BatColors.heading,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class SubmissionReviewCard extends StatelessWidget {
  const SubmissionReviewCard({
    super.key,
    required this.submission,
    required this.onTap,
  });

  final Map<String, dynamic> submission;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final student =
        submission['student_name']?.toString() ??
        (submission['student'] is Map
            ? (submission['student'] as Map)['full_name']?.toString()
            : null) ??
        '—';
    final taskTitle =
        submission['task_title']?.toString() ??
        (submission['task'] is Map
            ? (submission['task'] as Map)['title']?.toString()
            : null) ??
        '—';
    final status = SubmissionReviewStatus.fromApi(
      submission['review_status']?.toString() ??
          submission['status']?.toString(),
    );
    final pending = status == SubmissionReviewStatus.pending;

    return InstSoftCard(
      margin: const EdgeInsets.only(bottom: 10),
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: pending ? BatColors.accentSoft : BatColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.assignment_outlined,
              color: pending ? BatColors.accentHover : BatColors.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  taskTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$student · ${InstructorLabels.reviewStatusAr(status)}',
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
}
