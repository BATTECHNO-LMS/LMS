import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/assessment_models.dart';
import 'widgets/assessment_widgets.dart';

class AssessmentAttemptScreen extends ConsumerStatefulWidget {
  const AssessmentAttemptScreen({
    super.key,
    required this.opportunityId,
    required this.type,
  });

  final String opportunityId;
  final String type;

  @override
  ConsumerState<AssessmentAttemptScreen> createState() =>
      _AssessmentAttemptScreenState();
}

class _AssessmentAttemptScreenState
    extends ConsumerState<AssessmentAttemptScreen> {
  static const _pageBg = Color(0xFFF2F3F5);

  AssessmentDetailBundle? _bundle;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  int _currentIndex = 0;
  final Map<String, dynamic> _answers = {};

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
      final bundle = await ref
          .read(fieldTrainingRepositoryProvider)
          .loadAssessmentDetail(
            opportunityId: widget.opportunityId,
            type: widget.type,
          );
      if (bundle.hasSubmittedAttempt) {
        if (!mounted) return;
        context.replace(
          '/student/field-training/${widget.opportunityId}/assessments/${widget.type}/result',
          extra: bundle.attempt,
        );
        return;
      }
      setState(() => _bundle = bundle);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _questions => _bundle?.questions ?? const [];

  Future<bool> _confirmLeave() async {
    if (_answers.isEmpty) return true;
    final l10n = AppLocalizations.of(context);
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.leaveAssessmentTitle),
        content: Text(l10n.leaveAssessmentBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.continueAction),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.leaveAssessmentConfirm),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    final validation = AssessmentAnswerValidator.validateRequired(
      questions: _questions,
      answers: _answers,
    );
    if (validation != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(validation)));
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.submitAssessmentConfirmTitle),
        content: Text(l10n.submitAssessmentConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.continueAction),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.submitAssessment),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(fieldTrainingRepositoryProvider)
          .submitAssessment(
            opportunityId: widget.opportunityId,
            type: widget.type,
            answers: _answers,
          );
      if (!mounted) return;
      context.replace(
        '/student/field-training/${widget.opportunityId}/assessments/${widget.type}/result',
        extra: result.attempt,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmLeave() && context.mounted) context.pop();
      },
      child: Scaffold(
        backgroundColor: _pageBg,
        appBar: AppBar(
          title: Text(l10n.assessmentAttempt),
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          foregroundColor: BatColors.heading,
          elevation: 0,
          leading: BackButton(
            onPressed: () async {
              if (await _confirmLeave() && context.mounted) context.pop();
            },
          ),
        ),
        body: SafeArea(child: _buildBody(l10n)),
      ),
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

    if (_questions.isEmpty) {
      return EmptyState(
        title: l10n.assessmentNotReady,
        icon: Icons.quiz_outlined,
      );
    }

    final question = _questions[_currentIndex];
    final questionId = question['id']?.toString() ?? '$_currentIndex';
    final isLast = _currentIndex >= _questions.length - 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          QuestionProgressHeader(
            current: _currentIndex + 1,
            total: _questions.length,
            l10n: l10n,
          ),
          const SizedBox(height: 14),
          Expanded(
            child: SingleChildScrollView(
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
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        question['question_text']?.toString() ?? '',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                              height: 1.35,
                            ),
                      ),
                      const SizedBox(height: 16),
                      AssessmentQuestionField(
                        question: question,
                        value: _answers[questionId],
                        l10n: l10n,
                        enabled: !_submitting,
                        onChanged: (next) {
                          setState(() => _answers[questionId] = next);
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (_currentIndex > 0)
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () => setState(() => _currentIndex -= 1),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: BatColors.primary,
                      side: const BorderSide(color: Color(0xFFE6E8EC)),
                      backgroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      l10n.previousQuestion,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              if (_currentIndex > 0) const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          if (isLast) {
                            _submit();
                          } else {
                            setState(() => _currentIndex += 1);
                          }
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: BatColors.primary,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: BatColors.primary.withValues(
                      alpha: 0.5,
                    ),
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _submitting && isLast
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          isLast ? l10n.submitAssessment : l10n.nextQuestion,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
