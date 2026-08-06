import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
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
  static const _pageBg = Color(0xFFF2F3F5);

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
      backgroundColor: _pageBg,
      appBar: AppBar(
        title: Text(l10n.assessmentResult),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        foregroundColor: BatColors.heading,
        elevation: 0,
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
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
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
                      _SoftMetaCard(
                        icon: Icons.schedule_outlined,
                        label: l10n.submittedAt,
                        value: submittedAt,
                      ),
                    ],
                    if (nextAction?['label_ar'] != null) ...[
                      const SizedBox(height: 12),
                      _SoftMetaCard(
                        icon: Icons.flag_outlined,
                        label: nextAction!['label_ar'].toString(),
                        accent: true,
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () => context.go(
                          '/student/field-training/${widget.opportunityId}',
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: BatColors.primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        child: Text(
                          l10n.backToTraining,
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
}

class _SoftMetaCard extends StatelessWidget {
  const _SoftMetaCard({
    required this.icon,
    required this.label,
    this.value,
    this.accent = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final bool accent;

  @override
  Widget build(BuildContext context) {
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
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: accent ? BatColors.accentSoft : BatColors.primarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 22,
                color: accent ? BatColors.accentHover : BatColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: value == null
                          ? BatColors.heading
                          : BatColors.muted,
                      fontWeight: value == null
                          ? FontWeight.w700
                          : FontWeight.w500,
                      height: 1.35,
                    ),
                  ),
                  if (value != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      value!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
