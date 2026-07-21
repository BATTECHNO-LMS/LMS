import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
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
      appBar: AppBar(
        title: Text(AssessmentLabels.typeTitleAr(widget.type)),
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
    final title =
        assessment['title']?.toString() ??
        AssessmentLabels.typeTitleAr(widget.type);
    final passingScore =
        JsonHelpers.integer(assessment, ['passing_score']) ??
        _summary?.passingScore;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          AssessmentInstructionsCard(
            l10n: l10n,
            description: assessment['description']?.toString(),
            questionCount: _bundle!.questions.length,
            passingScore: passingScore,
          ),
          const SizedBox(height: 16),
          PrimaryButton(
            label: _action == AssessmentPrimaryAction.viewResult
                ? l10n.viewAssessmentResult
                : _action == AssessmentPrimaryAction.start
                ? l10n.startAssessment
                : l10n.assessmentUnavailable,
            onPressed:
                _action == AssessmentPrimaryAction.start ||
                    _action == AssessmentPrimaryAction.viewResult
                ? () => _onPrimaryAction(l10n)
                : null,
          ),
        ],
      ),
    );
  }
}
