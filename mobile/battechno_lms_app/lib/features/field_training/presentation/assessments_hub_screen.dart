import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/assessment_models.dart';
import 'widgets/assessment_widgets.dart';

class AssessmentsHubScreen extends ConsumerStatefulWidget {
  const AssessmentsHubScreen({
    super.key,
    required this.opportunityId,
    this.opportunityTitle,
    this.requiresPre = true,
    this.requiresPost = true,
  });

  final String opportunityId;
  final String? opportunityTitle;
  final bool requiresPre;
  final bool requiresPost;

  @override
  ConsumerState<AssessmentsHubScreen> createState() =>
      _AssessmentsHubScreenState();
}

class _AssessmentsHubScreenState extends ConsumerState<AssessmentsHubScreen> {
  List<StudentAssessmentSummary> _assessments = const [];
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
      final items = await ref
          .read(fieldTrainingRepositoryProvider)
          .loadAssessments(widget.opportunityId);
      setState(() => _assessments = items);
    } on ApiException catch (e) {
      setState(() => _error = e.isNetwork ? 'network' : e.message);
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  StudentAssessmentSummary? _byType(String type) {
    for (final item in _assessments) {
      if (item.type == type) return item;
    }
    return null;
  }

  void _openType(String type) {
    context.push(
      '/student/field-training/${widget.opportunityId}/assessments/$type',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.assessmentsTitle),
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

    if (!widget.requiresPre && !widget.requiresPost) {
      return EmptyState(
        title: l10n.noAssessmentsRequired,
        icon: Icons.quiz_outlined,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.opportunityTitle != null) ...[
            Text(
              widget.opportunityTitle!,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
          ],
          if (widget.requiresPre)
            AssessmentSummaryCard(
              type: 'pre',
              title: _byType('pre')?.title ?? l10n.preAssessment,
              summary: _byType('pre'),
              action: AssessmentLabels.resolveAction(
                summary: _byType('pre'),
                isRequired: widget.requiresPre,
              ),
              l10n: l10n,
              onTap: () => _openType('pre'),
            ),
          if (widget.requiresPost)
            AssessmentSummaryCard(
              type: 'post',
              title: _byType('post')?.title ?? l10n.postAssessment,
              summary: _byType('post'),
              action: AssessmentLabels.resolveAction(
                summary: _byType('post'),
                isRequired: widget.requiresPost,
              ),
              l10n: l10n,
              onTap: () => _openType('post'),
            ),
        ],
      ),
    );
  }
}
