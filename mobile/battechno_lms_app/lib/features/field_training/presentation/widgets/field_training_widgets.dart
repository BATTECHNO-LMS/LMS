import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/field_training_models.dart';

class TrainingProgressSection extends StatelessWidget {
  const TrainingProgressSection({
    super.key,
    required this.progress,
    required this.opportunity,
    required this.l10n,
  });

  final Map<String, dynamic>? progress;
  final Map<String, dynamic> opportunity;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final metrics = JsonHelpers.map(progress?['metrics']) ?? {};
    final nextAction = JsonHelpers.map(progress?['next_action']);
    final requiredHours = JsonHelpers.integer(opportunity, [
      'required_training_hours',
    ]);
    final completedHours = JsonHelpers.integer(metrics, [
      'completed_hours',
      'completed_training_hours',
    ]);

    final tasksTotal =
        JsonHelpers.integer(metrics, ['tasks_count', 'total_tasks_count']) ?? 0;
    final tasksSubmitted =
        JsonHelpers.integer(metrics, [
          'tasks_submitted',
          'submitted_tasks_count',
        ]) ??
        0;
    final taskProgress = tasksTotal > 0 ? tasksSubmitted / tasksTotal : 0.0;
    final overallProgress =
        JsonHelpers.percent(progress, ['progress', 'progress_percent']) ??
        taskProgress;

    int? remainingHours;
    if (requiredHours != null && completedHours != null) {
      remainingHours = (requiredHours - completedHours).clamp(0, requiredHours);
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.trainingProgress,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 12),
            if (requiredHours == null)
              InfoBanner(message: l10n.requiredHoursNotSet)
            else ...[
              _metricRow(l10n.requiredHours, '$requiredHours'),
              if (completedHours != null)
                _metricRow(l10n.completedHours, '$completedHours'),
              if (remainingHours != null)
                _metricRow(l10n.remainingHours, '$remainingHours'),
            ],
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(BatRadii.pill),
              child: LinearProgressIndicator(
                value: overallProgress.clamp(0, 1),
                minHeight: 8,
                color: BatColors.accent,
                backgroundColor: BatColors.primarySoft,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${(overallProgress * 100).round()}%',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: BatColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              l10n.tasksProgressLabel(tasksSubmitted, tasksTotal),
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
            if (nextAction?['label_ar'] != null) ...[
              const SizedBox(height: 12),
              InfoBanner(message: nextAction!['label_ar'].toString()),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metricRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class TaskCard extends StatelessWidget {
  const TaskCard({super.key, required this.task, required this.onTap});

  final Map<String, dynamic> task;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final submission = JsonHelpers.map(task['submission']);
    final reviewStatus = submission?['review_status']?.toString();
    final dueDate = task['due_date']?.toString();
    final hasSubmission = submission != null;

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
                      task['title']?.toString() ?? l10n.taskUntitled,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  StatusChip(
                    label: FieldTrainingLabels.reviewStatusAr(
                      hasSubmission ? reviewStatus : null,
                    ),
                    color: reviewStatus == 'approved'
                        ? BatColors.success
                        : BatColors.info,
                  ),
                ],
              ),
              if (dueDate != null && dueDate.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  '${l10n.dueDate}: $dueDate',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
              if (submission?['instructor_feedback'] != null &&
                  submission!['instructor_feedback'].toString().isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  submission['instructor_feedback'].toString(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class TaskListSection extends StatelessWidget {
  const TaskListSection({
    super.key,
    required this.tasks,
    required this.onTaskTap,
  });

  final List<Map<String, dynamic>> tasks;
  final void Function(Map<String, dynamic> task) onTaskTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (tasks.isEmpty) {
      return EmptyState(
        title: l10n.noTasksCurrently,
        icon: Icons.task_outlined,
      );
    }
    return Column(
      children: [
        for (final task in tasks)
          TaskCard(task: task, onTap: () => onTaskTap(task)),
      ],
    );
  }
}
