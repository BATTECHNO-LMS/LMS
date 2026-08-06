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

  bool get _canAct =>
      action == AssessmentPrimaryAction.start ||
      action == AssessmentPrimaryAction.viewResult;

  @override
  Widget build(BuildContext context) {
    if (!isRequired) return const SizedBox.shrink();

    final heading = type == 'pre'
        ? l10n.preAssessment
        : type == 'post'
        ? l10n.postAssessment
        : l10n.assessmentsTitle;
    final subtitle = title.trim().isNotEmpty && title != heading ? title : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE6E8EC)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1A2330).withValues(alpha: 0.05),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
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
                      Icons.quiz_outlined,
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
                          heading,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: BatColors.heading,
                                height: 1.2,
                              ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: const Color(0xFF8B93A0),
                                  height: 1.35,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _AssessmentStatusBadge(
                    label: _statusLabel(),
                    tone: _statusTone(),
                  ),
                ],
              ),
              if (summary?.score != null) ...[
                const SizedBox(height: 10),
                Text(
                  l10n.assessmentScoreLabel(summary!.score!),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: BatColors.heading,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _canAct ? onTap : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: _canAct
                        ? BatColors.primary
                        : const Color(0xFFE9EBEE),
                    foregroundColor: _canAct
                        ? Colors.white
                        : const Color(0xFF8B93A0),
                    disabledBackgroundColor: const Color(0xFFE9EBEE),
                    disabledForegroundColor: const Color(0xFF8B93A0),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(
                    _actionLabel(),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
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
        return l10n.assessmentUnavailable;
    }
  }

  _StatusTone _statusTone() {
    switch (action) {
      case AssessmentPrimaryAction.start:
        return _StatusTone.available;
      case AssessmentPrimaryAction.viewResult:
        return _StatusTone.completed;
      case AssessmentPrimaryAction.notPublished:
      case AssessmentPrimaryAction.unavailable:
        return _StatusTone.unavailable;
    }
  }

  String _actionLabel() {
    switch (action) {
      case AssessmentPrimaryAction.start:
        return l10n.startAssessment;
      case AssessmentPrimaryAction.viewResult:
        return l10n.viewAssessmentResult;
      case AssessmentPrimaryAction.notPublished:
        return l10n.assessmentUnavailable;
      case AssessmentPrimaryAction.unavailable:
        return l10n.assessmentUnavailable;
    }
  }
}

enum _StatusTone { available, completed, unavailable }

class _AssessmentStatusBadge extends StatelessWidget {
  const _AssessmentStatusBadge({required this.label, required this.tone});

  final String label;
  final _StatusTone tone;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    switch (tone) {
      case _StatusTone.available:
        bg = BatColors.accentSoft;
        fg = BatColors.accentHover;
      case _StatusTone.completed:
        bg = BatColors.success.withValues(alpha: 0.12);
        fg = BatColors.successText;
      case _StatusTone.unavailable:
        bg = const Color(0xFFEEF0F3);
        fg = const Color(0xFF8B93A0);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
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
    final metaStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: const Color(0xFF8B93A0),
      height: 1.4,
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.assessmentInstructions,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: BatColors.heading,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              (description != null && description!.trim().isNotEmpty)
                  ? description!
                  : l10n.assessmentDefaultInstructions,
              style: metaStyle,
            ),
            if (questionCount != null) ...[
              const SizedBox(height: 10),
              Text(
                l10n.assessmentQuestionCountLabel(questionCount!),
                style: metaStyle,
              ),
            ],
            if (passingScore != null) ...[
              const SizedBox(height: 4),
              Text(
                l10n.assessmentPassScoreLabel(passingScore!),
                style: metaStyle,
              ),
            ],
            const SizedBox(height: 14),
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
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.assessmentQuestionProgress(current, total),
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
                    color: BatColors.primarySoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$current/$total',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: BatColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(BatRadii.pill),
              child: LinearProgressIndicator(
                value: progress.clamp(0, 1),
                minHeight: 8,
                color: BatColors.primary,
                backgroundColor: const Color(0xFFE6E8EC),
              ),
            ),
          ],
        ),
      ),
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
              _SoftChoiceTile(
                label: opt.toString(),
                selected: value?.toString() == opt.toString(),
                multi: false,
                enabled: enabled,
                onTap: () => onChanged(opt.toString()),
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
              _SoftChoiceTile(
                label: opt.toString(),
                selected: selected.contains(opt.toString()),
                multi: true,
                enabled: enabled,
                onTap: () {
                  final list = List<String>.from(selected);
                  final key = opt.toString();
                  if (list.contains(key)) {
                    list.remove(key);
                  } else {
                    list.add(key);
                  }
                  onChanged(list);
                },
              ),
          ],
        );
      case AssessmentQuestionType.trueFalse:
        return Column(
          children: [
            _SoftChoiceTile(
              label: l10n.trueAnswer,
              selected: value?.toString() == 'true',
              multi: false,
              enabled: enabled,
              onTap: () => onChanged('true'),
            ),
            _SoftChoiceTile(
              label: l10n.falseAnswer,
              selected: value?.toString() == 'false',
              multi: false,
              enabled: enabled,
              onTap: () => onChanged('false'),
            ),
          ],
        );
      case AssessmentQuestionType.shortText:
        return TextFormField(
          key: ValueKey('short-${question['id']}'),
          initialValue: value?.toString(),
          enabled: enabled,
          decoration: InputDecoration(
            labelText: l10n.yourAnswer,
            filled: true,
            fillColor: const Color(0xFFF7F8FA),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: BatColors.primary,
                width: 1.4,
              ),
            ),
          ),
          onChanged: (text) => onChanged(text),
        );
      case AssessmentQuestionType.longText:
        return TextFormField(
          key: ValueKey('long-${question['id']}'),
          initialValue: value?.toString(),
          enabled: enabled,
          minLines: 4,
          maxLines: 8,
          decoration: InputDecoration(
            labelText: l10n.yourAnswer,
            filled: true,
            fillColor: const Color(0xFFF7F8FA),
            alignLabelWithHint: true,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFE6E8EC)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: BatColors.primary,
                width: 1.4,
              ),
            ),
          ),
          onChanged: (text) => onChanged(text),
        );
      case AssessmentQuestionType.unsupported:
        return InfoBanner(message: l10n.unsupportedQuestionType);
    }
  }
}

class _SoftChoiceTile extends StatelessWidget {
  const _SoftChoiceTile({
    required this.label,
    required this.selected,
    required this.multi,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool multi;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? BatColors.primarySoft : const Color(0xFFF7F8FA),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected
                    ? BatColors.primaryLight
                    : const Color(0xFFE6E8EC),
                width: selected ? 1.4 : 1,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  multi
                      ? (selected
                            ? Icons.check_box_rounded
                            : Icons.check_box_outline_blank_rounded)
                      : (selected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_off_rounded),
                  size: 22,
                  color: selected ? BatColors.primary : const Color(0xFF8B93A0),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      color: BatColors.heading,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
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

    final badgeBg = passed == true
        ? BatColors.success.withValues(alpha: 0.12)
        : passed == false
        ? const Color(0xFFEEF0F3)
        : BatColors.accentSoft;
    final badgeFg = passed == true
        ? BatColors.successText
        : passed == false
        ? const Color(0xFF8B93A0)
        : BatColors.accentHover;
    final iconBg = passed == true
        ? BatColors.success.withValues(alpha: 0.12)
        : BatColors.primarySoft;
    final iconColor = passed == true ? BatColors.success : BatColors.primary;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE6E8EC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1A2330).withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                passed == true
                    ? Icons.emoji_events_outlined
                    : Icons.fact_check_outlined,
                size: 36,
                color: iconColor,
              ),
            ),
            const SizedBox(height: 16),
            if (score != null)
              Text(
                l10n.assessmentScoreLabel(score!),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: BatColors.heading,
                ),
              ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: badgeBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                passedLabel,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: badgeFg,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (level != null) ...[
              const SizedBox(height: 10),
              Text(
                AssessmentLabels.knowledgeLevelAr(level),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: BatColors.muted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            if (pendingManual) ...[
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: BatColors.accentSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.hourglass_top_outlined,
                      size: 18,
                      color: BatColors.accentHover,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        l10n.assessmentPendingManual,
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
          ],
        ),
      ),
    );
  }
}
