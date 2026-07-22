import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/field_training_repository.dart';
import '../domain/field_training_models.dart';
import 'widgets/assessment_widgets.dart';

class AssessmentResultScreen extends ConsumerStatefulWidget {
  const AssessmentResultScreen({
    super.key,
    required this.opportunityId,
    required this.type,
    this.initialAttempt,
  });

  final String opportunityId;
  final String type;
  final Map<String, dynamic>? initialAttempt;

  @override
  ConsumerState<AssessmentResultScreen> createState() =>
      _AssessmentResultScreenState();
}

class _AssessmentResultScreenState
    extends ConsumerState<AssessmentResultScreen> {
  Map<String, dynamic>? _attempt;
  Map<String, dynamic>? _progress;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _attempt = widget.initialAttempt;
    WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(fieldTrainingRepositoryProvider);
      final progress = await repo.loadProgress(widget.opportunityId);
      Map<String, dynamic>? attempt = _attempt;
      if (attempt == null) {
        final detail = await repo.loadAssessmentDetail(
          opportunityId: widget.opportunityId,
          type: widget.type,
        );
        attempt = detail.attempt;
      }
      setState(() {
        _progress = progress;
        _attempt = attempt;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool? _passed(AppLocalizations l10n) {
    if (widget.type != 'post') return null;
    final metrics = JsonHelpers.map(_progress?['metrics']);
    if (metrics?['post_assessment_passed'] is bool) {
      return metrics!['post_assessment_passed'] as bool;
    }
    final score = JsonHelpers.integer(_attempt, ['score']);
    final passing = JsonHelpers.integer(_attempt, ['passing_score']);
    if (score != null && passing != null) return score >= passing;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final score = JsonHelpers.integer(_attempt, ['score']);
    final level = _attempt?['level']?.toString();
    final pendingManual = _attempt?['has_pending_manual'] == true;
    final submittedAt = _attempt?['submitted_at']?.toString();
    final nextAction = JsonHelpers.map(_progress?['next_action']);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.assessmentResult),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: SafeArea(
        child: _loading && _attempt == null
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: LoadingSkeleton(lines: 3),
              )
            : RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    AssessmentResultHero(
                      l10n: l10n,
                      score: score,
                      passed: _passed(l10n),
                      level: level,
                      pendingManual: pendingManual,
                    ),
                    if (submittedAt != null) ...[
                      const SizedBox(height: 12),
                      Text('${l10n.submittedAt}: $submittedAt'),
                    ],
                    if (nextAction?['label_ar'] != null) ...[
                      const SizedBox(height: 16),
                      InfoBanner(message: nextAction!['label_ar'].toString()),
                    ],
                    const SizedBox(height: 20),
                    PrimaryButton(
                      label: l10n.backToTraining,
                      onPressed: () => context.go(
                        '/student/field-training/${widget.opportunityId}',
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
