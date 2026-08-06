import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/assessment_models.dart';
import '../domain/field_training_models.dart';
import 'widgets/assessment_widgets.dart';

class AssessmentOverviewScreen extends ConsumerStatefulWidget {
  const AssessmentOverviewScreen({
    super.key,
    required this.opportunityId,
    required this.type,
  });

  final String opportunityId;
  final String type;

  @override
  ConsumerState<AssessmentOverviewScreen> createState() =>
      _AssessmentOverviewScreenState();
}

class _AssessmentOverviewScreenState
    extends ConsumerState<AssessmentOverviewScreen> {
  AssessmentDetailBundle? _bundle;
  StudentAssessmentSummary? _summary;
  bool _loading = true;
  String? _error;

  static const _pageBg = Color(0xFFF2F3F5);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(fieldTrainingRepositoryProvider);
      final results = await Future.wait([
        repo.loadAssessmentDetail(
          opportunityId: widget.opportunityId,
          type: widget.type,
        ),
        repo.loadAssessments(widget.opportunityId),
      ]);
      final detail = results[0] as AssessmentDetailBundle;
      final list = results[1] as List<StudentAssessmentSummary>;
      StudentAssessmentSummary? summary;
      for (final item in list) {
        if (item.type == widget.type) {
          summary = item;
          break;
        }
      }
      setState(() {
        _bundle = detail;
        _summary = summary;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  AssessmentPrimaryAction get _action =>
      AssessmentLabels.resolveAction(summary: _summary, isRequired: true);

  String _typeTitle(AppLocalizations l10n) {
    switch (widget.type) {
      case 'pre':
        return l10n.preAssessment;
      case 'post':
        return l10n.postAssessment;
      default:
        return l10n.assessmentsTitle;
    }
  }

  void _onPrimaryAction(AppLocalizations l10n) {
    if (_action == AssessmentPrimaryAction.viewResult) {
      context.push(
        '/student/field-training/${widget.opportunityId}/assessments/${widget.type}/result',
        extra: _bundle?.attempt ?? _summary?.attempt,
      );
      return;
    }
    if (_action != AssessmentPrimaryAction.start) return;
    context.push(
      '/student/field-training/${widget.opportunityId}/assessments/${widget.type}/attempt',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Text(_typeTitle(l10n)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(child: _buildBody(l10n)),
    );
  }

  Widget _buildBody(AppLocalizations l10n) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: LoadingSkeleton(lines: 4),
      );
    }
    if (_error == 'network') {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: l10n.networkErrorBody,
        onRetry: _load,
      );
    }
    if (_error != null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error!,
        onRetry: _load,
      );
    }

    final assessment = _bundle!.assessment;
    final title = assessment['title']?.toString() ?? _typeTitle(l10n);
    final passingScore =
        JsonHelpers.integer(assessment, ['passing_score']) ??
        _summary?.passingScore;
    final canAct =
        _action == AssessmentPrimaryAction.start ||
        _action == AssessmentPrimaryAction.viewResult;
    final actionLabel = switch (_action) {
      AssessmentPrimaryAction.viewResult => l10n.viewAssessmentResult,
      AssessmentPrimaryAction.start => l10n.startAssessment,
      _ => l10n.assessmentUnavailable,
    };

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          _AssessmentOverviewHero(
            typeTitle: _typeTitle(l10n),
            title: title,
            action: _action,
            l10n: l10n,
          ),
          const SizedBox(height: 14),
          AssessmentInstructionsCard(
            l10n: l10n,
            description: assessment['description']?.toString(),
            questionCount: _bundle!.questions.length,
            passingScore: passingScore,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: canAct ? () => _onPrimaryAction(l10n) : null,
              style: FilledButton.styleFrom(
                backgroundColor: canAct
                    ? BatColors.primary
                    : const Color(0xFFE9EBEE),
                foregroundColor: canAct
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
                actionLabel,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssessmentOverviewHero extends StatelessWidget {
  const _AssessmentOverviewHero({
    required this.typeTitle,
    required this.title,
    required this.action,
    required this.l10n,
  });

  final String typeTitle;
  final String title;
  final AssessmentPrimaryAction action;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final statusLabel = switch (action) {
      AssessmentPrimaryAction.start => l10n.assessmentAvailable,
      AssessmentPrimaryAction.viewResult => l10n.assessmentCompleted,
      AssessmentPrimaryAction.notPublished => l10n.assessmentNotPublished,
      AssessmentPrimaryAction.unavailable => l10n.assessmentUnavailable,
    };
    final statusBg = switch (action) {
      AssessmentPrimaryAction.start => BatColors.accentSoft,
      AssessmentPrimaryAction.viewResult => BatColors.success.withValues(
        alpha: 0.12,
      ),
      _ => const Color(0xFFEEF0F3),
    };
    final statusFg = switch (action) {
      AssessmentPrimaryAction.start => BatColors.accentHover,
      AssessmentPrimaryAction.viewResult => BatColors.successText,
      _ => const Color(0xFF8B93A0),
    };

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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
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
                    typeTitle,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: BatColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.heading,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                statusLabel,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: statusFg,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
