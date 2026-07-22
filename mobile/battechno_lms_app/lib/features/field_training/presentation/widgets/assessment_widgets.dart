import 'package:flutter/material.dart';

import '../../../../app/localization/l10n/app_localizations.dart';
import '../../../../app/theme/bat_colors.dart';
import '../../../../core/widgets/bat_widgets.dart';
import '../../domain/assessment_models.dart';

class AssessmentSummaryCard extends StatelessWidget {
  const AssessmentSummaryCard({
    super.key,
    required this.type,
    required this.title,
    required this.action,
    required this.l10n,
    this.summary,
    this.isRequired = true,
    this.onTap,
  });

  final String type;
  final String title;
  final AssessmentPrimaryAction action;
  final AppLocalizations l10n;
  final StudentAssessmentSummary? summary;
  final bool isRequired;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    if (!isRequired) return const SizedBox.shrink();

    final statusLabel = _statusLabel();
    final statusColor = _statusColor();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(BatRadii.lg),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: BatColors.primarySoft,
                      borderRadius: BorderRadius.circular(BatRadii.md),
                    ),
                    child: const Icon(
                      Icons.quiz_outlined,
                      color: BatColors.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          AssessmentLabels.typeTitleAr(type),
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                              ),
                        ),
                        Text(
                          title,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                  StatusChip(label: statusLabel, color: statusColor),
                ],
              ),
              if (summary?.score != null) ...[
                const SizedBox(height: 10),
                Text(
                  l10n.assessmentScoreLabel(summary!.score!),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
              if (summary?.passingScore != null) ...[
                const SizedBox(height: 6),
                Text(
                  l10n.assessmentPassScoreLabel(summary!.passingScore!),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                ),
              ],
              const SizedBox(height: 12),
              PrimaryButton(
                label: _actionLabel(),
                onPressed:
                    action == AssessmentPrimaryAction.unavailable ||
                        action == AssessmentPrimaryAction.notPublished
                    ? null
                    : onTap,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _statusLabel() {
    switch (action) {
      case AssessmentPrimaryAction.start:
        return l10n.assessmentAvailable;
      case AssessmentPrimaryAction.viewResult:
        return l10n.assessmentCompleted;
      case AssessmentPrimaryAction.notPublished:
        return l10n.assessmentNotPublished;
      case AssessmentPrimaryAction.unavailable:
        return l10n.assessmentLocked;
    }
  }

  Color _statusColor() {
    switch (action) {
      case AssessmentPrimaryAction.start:
        return BatColors.accent;
      case AssessmentPrimaryAction.viewResult:
        return BatColors.success;
      case AssessmentPrimaryAction.notPublished:
      case AssessmentPrimaryAction.unavailable:
        return BatColors.muted;
    }
  }

  String _actionLabel() {
    switch (action) {
      case AssessmentPrimaryAction.start:
        return l10n.startAssessment;
      case AssessmentPrimaryAction.viewResult:
        return l10n.viewAssessmentResult;
      case AssessmentPrimaryAction.notPublished:
        return l10n.assessmentNotPublished;
      case AssessmentPrimaryAction.unavailable:
        return l10n.assessmentUnavailable;
    }
  }
}

class AssessmentInstructionsCard extends StatelessWidget {
  const AssessmentInstructionsCard({
    super.key,
    required this.l10n,
    this.description,
    this.questionCount,
    this.passingScore,
  });

  final AppLocalizations l10n;
  final String? description;
  final int? questionCount;
  final int? passingScore;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.assessmentInstructions,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            if (description != null && description!.isNotEmpty)
              Text(description!)
            else
              Text(l10n.assessmentDefaultInstructions),
            if (questionCount != null) ...[
              const SizedBox(height: 8),
              Text(l10n.assessmentQuestionCountLabel(questionCount!)),
            ],
            if (passingScore != null) ...[
              const SizedBox(height: 4),
              Text(l10n.assessmentPassScoreLabel(passingScore!)),
            ],
            const SizedBox(height: 12),
            InfoBanner(message: l10n.assessmentStartWarning),
          ],
        ),
      ),
    );
  }
}

class QuestionProgressHeader extends StatelessWidget {
  const QuestionProgressHeader({
    super.key,
    required this.current,
    required this.total,
    required this.l10n,
  });

  final int current;
  final int total;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final progress = total > 0 ? current / total : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.assessmentQuestionProgress(current, total),
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(BatRadii.pill),
          child: LinearProgressIndicator(
            value: progress.clamp(0, 1),
            minHeight: 6,
            color: BatColors.accent,
            backgroundColor: BatColors.primarySoft,
          ),
        ),
      ],
    );
  }
}

class AssessmentQuestionField extends StatelessWidget {
  const AssessmentQuestionField({
    super.key,
    required this.question,
    required this.value,
    required this.onChanged,
    required this.l10n,
    this.enabled = true,
  });

  final Map<String, dynamic> question;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  final AppLocalizations l10n;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final type = AssessmentLabels.parseQuestionType(
      question['question_type']?.toString(),
    );
    final options = question['options'];

    switch (type) {
      case AssessmentQuestionType.multipleChoice:
        if (options is! List) {
          return InfoBanner(message: l10n.unsupportedQuestionType);
        }
        return Column(
          children: [
            for (final opt in options)
              RadioListTile<String>(
                value: opt.toString(),
                groupValue: value?.toString(),
                onChanged: enabled
                    ? (next) {
                        if (next != null) onChanged(next);
                      }
                    : null,
                title: Text(opt.toString()),
                contentPadding: EdgeInsets.zero,
              ),
          ],
        );
      case AssessmentQuestionType.multiSelect:
        if (options is! List) {
          return InfoBanner(message: l10n.unsupportedQuestionType);
        }
        final selected = value is List
            ? value.map((e) => e.toString()).toList()
            : <String>[];
        return Column(
          children: [
            for (final opt in options)
              CheckboxListTile(
                value: selected.contains(opt.toString()),
                onChanged: enabled
                    ? (checked) {
                        final list = List<String>.from(selected);
                        final key = opt.toString();
                        if (checked == true) {
                          if (!list.contains(key)) list.add(key);
                        } else {
                          list.remove(key);
                        }
                        onChanged(list);
                      }
                    : null,
                title: Text(opt.toString()),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
              ),
          ],
        );
      case AssessmentQuestionType.trueFalse:
        return Column(
          children: [
            RadioListTile<String>(
              value: 'true',
              groupValue: value?.toString(),
              onChanged: enabled ? (v) => onChanged(v) : null,
              title: Text(l10n.trueAnswer),
              contentPadding: EdgeInsets.zero,
            ),
            RadioListTile<String>(
              value: 'false',
              groupValue: value?.toString(),
              onChanged: enabled ? (v) => onChanged(v) : null,
              title: Text(l10n.falseAnswer),
              contentPadding: EdgeInsets.zero,
            ),
          ],
        );
      case AssessmentQuestionType.shortText:
        return TextFormField(
          key: ValueKey('short-${question['id']}'),
          initialValue: value?.toString(),
          enabled: enabled,
          decoration: InputDecoration(labelText: l10n.yourAnswer),
          onChanged: (text) => onChanged(text),
        );
      case AssessmentQuestionType.longText:
        return TextFormField(
          key: ValueKey('long-${question['id']}'),
          initialValue: value?.toString(),
          enabled: enabled,
          minLines: 4,
          maxLines: 8,
          decoration: InputDecoration(labelText: l10n.yourAnswer),
          onChanged: (text) => onChanged(text),
        );
      case AssessmentQuestionType.unsupported:
        return InfoBanner(message: l10n.unsupportedQuestionType);
    }
  }
}

class AssessmentResultHero extends StatelessWidget {
  const AssessmentResultHero({
    super.key,
    required this.l10n,
    required this.score,
    required this.passed,
    this.level,
    this.pendingManual = false,
  });

  final AppLocalizations l10n;
  final int? score;
  final bool? passed;
  final String? level;
  final bool pendingManual;

  @override
  Widget build(BuildContext context) {
    final passedLabel = passed == null
        ? l10n.assessmentResultPending
        : passed!
        ? l10n.assessmentPassed
        : l10n.assessmentNotPassed;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Icon(
              passed == true
                  ? Icons.emoji_events_outlined
                  : Icons.fact_check_outlined,
              size: 48,
              color: passed == true ? BatColors.success : BatColors.primary,
            ),
            const SizedBox(height: 12),
            if (score != null)
              Text(
                l10n.assessmentScoreLabel(score!),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            const SizedBox(height: 8),
            StatusChip(
              label: passedLabel,
              color: passed == true ? BatColors.success : BatColors.info,
            ),
            if (level != null) ...[
              const SizedBox(height: 8),
              Text(AssessmentLabels.knowledgeLevelAr(level)),
            ],
            if (pendingManual) ...[
              const SizedBox(height: 12),
              InfoBanner(message: l10n.assessmentPendingManual),
            ],
          ],
        ),
      ),
    );
  }
}
