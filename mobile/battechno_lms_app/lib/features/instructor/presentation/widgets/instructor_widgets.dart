import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/instructor_models.dart';

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
    return Card(
      color: BatColors.primary.withValues(alpha: 0.06),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: BatColors.accent.withValues(alpha: 0.25),
                child: Icon(icon, color: BatColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_left),
            ],
          ),
        ),
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
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      opportunity.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  StatusChip(
                    label: InstructorLabels.statusAr(opportunity.status),
                    color: BatColors.primary,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (opportunity.specialtyName != null)
                Text(opportunity.specialtyName!),
              Text(
                '${InstructorLabels.modeAr(opportunity.trainingMode)}'
                '${opportunity.startDate != null ? ' · ${opportunity.startDate}' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _meta(
                    Icons.groups_outlined,
                    '${opportunity.participantsCount} ${l10n.students}',
                  ),
                  _meta(
                    Icons.event_outlined,
                    '${opportunity.sessionsCount} ${l10n.sessions}',
                  ),
                  if (opportunity.pendingSubmissionsCount > 0)
                    _meta(
                      Icons.assignment_late_outlined,
                      l10n.pendingSubmissionsCount(
                        opportunity.pendingSubmissionsCount,
                      ),
                    ),
                  if (opportunity.requiredHours != null)
                    _meta(
                      Icons.schedule_outlined,
                      '${opportunity.requiredHours} ${l10n.hours}',
                    )
                  else
                    _meta(Icons.schedule_outlined, l10n.hoursNotSpecified),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _meta(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12)),
      ],
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

    return Card(
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(
          child: Text(name.isNotEmpty ? name.characters.first : '?'),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          '${InstructorLabels.statusAr(trainingStatus)} · ${l10n.attendance}: $attendanceLabel',
        ),
        trailing: const Icon(Icons.chevron_left),
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
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final status in options)
          ChoiceChip(
            label: Text(InstructorLabels.attendanceAr(status)),
            selected: value == status,
            onSelected: (_) => onChanged(status),
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

    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text(
          taskTitle,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text('$student · ${InstructorLabels.reviewStatusAr(status)}'),
        trailing: const Icon(Icons.chevron_left),
      ),
    );
  }
}
