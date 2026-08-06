import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/field_training_models.dart';

const Color kFtPageBg = Color(0xFFF2F3F5);

class FtSoftCard extends StatelessWidget {
  const FtSoftCard({
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

    final percent = (overallProgress.clamp(0, 1) * 100).round();

    return FtSoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.trending_up_rounded,
                  color: BatColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  l10n.trainingProgress,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                  ),
                ),
              ),
              Text(
                '$percent%',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: BatColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (requiredHours == null)
            InfoBanner(message: l10n.requiredHoursNotSet)
          else ...[
            _metricRow(context, l10n.requiredHours, '$requiredHours'),
            if (completedHours != null)
              _metricRow(context, l10n.completedHours, '$completedHours'),
            if (remainingHours != null)
              _metricRow(context, l10n.remainingHours, '$remainingHours'),
          ],
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(BatRadii.pill),
            child: LinearProgressIndicator(
              value: overallProgress.clamp(0, 1),
              minHeight: 8,
              color: BatColors.primaryLight,
              backgroundColor: const Color(0xFFE6E8EC),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.tasksProgressLabel(tasksSubmitted, tasksTotal),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: BatColors.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (nextAction?['label_ar'] != null) ...[
            const SizedBox(height: 12),
            InfoBanner(message: nextAction!['label_ar'].toString()),
          ],
        ],
      ),
    );
  }

  Widget _metricRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
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
    final approved = reviewStatus == 'approved';

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
                child: Icon(
                  hasSubmission ? Icons.task_alt_rounded : Icons.task_outlined,
                  color: BatColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  task['title']?.toString() ?? l10n.taskUntitled,
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
                  color: approved
                      ? BatColors.success.withValues(alpha: 0.12)
                      : const Color(0xFFEEF0F3),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  FieldTrainingLabels.reviewStatusAr(
                    hasSubmission ? reviewStatus : null,
                  ),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: approved
                        ? BatColors.successText
                        : const Color(0xFF8B93A0),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          if (dueDate != null && dueDate.isNotEmpty) ...[
            const SizedBox(height: 10),
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
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
            ),
          ],
        ],
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
