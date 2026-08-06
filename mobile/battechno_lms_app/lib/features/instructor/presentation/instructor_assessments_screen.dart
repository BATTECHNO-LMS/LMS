import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../app/theme/bat_colors.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';
import 'widgets/instructor_widgets.dart';

class InstructorAssessmentsScreen extends ConsumerStatefulWidget {
  const InstructorAssessmentsScreen({super.key, required this.opportunityId});

  final String opportunityId;

  @override
  ConsumerState<InstructorAssessmentsScreen> createState() =>
      _InstructorAssessmentsScreenState();
}

class _InstructorAssessmentsScreenState
    extends ConsumerState<InstructorAssessmentsScreen> {
  List<Map<String, dynamic>> _assessments = const [];
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
      final list = await ref
          .read(instructorRepositoryProvider)
          .listAssessments(widget.opportunityId);
      setState(() => _assessments = list);
    } on ApiException catch (e) {
      setState(() {
        _error = e.statusCode == 403
            ? 'forbidden'
            : (e.isNetwork ? 'network' : e.message);
      });
    } catch (_) {
      setState(() => _error = 'unknown');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _attemptCount(Map<String, dynamic> assessment) {
    final attempts = assessment['attempts'];
    if (attempts is List) return attempts.length;
    return 0;
  }

  int get _totalAttempts =>
      _assessments.fold<int>(0, (sum, a) => sum + _attemptCount(a));

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      backgroundColor: kInstructorPageBg,
      appBar: AppBar(
        title: Text(l10n.assessmentResults),
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
    if (_error != null) {
      return RetryView(
        title: l10n.networkErrorTitle,
        message: _error == 'forbidden'
            ? l10n.forbiddenAccess
            : l10n.networkErrorBody,
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          InstSoftCard(
            child: Row(
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
                        l10n.assessmentResults,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: BatColors.heading,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.viewAssessmentResults,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: BatColors.accentSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$_totalAttempts',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: BatColors.accentHover,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_assessments.isEmpty)
            EmptyState(
              title: l10n.noAssessmentResults,
              icon: Icons.quiz_outlined,
            )
          else
            for (final assessment in _assessments)
              _AssessmentResultCard(
                assessment: assessment,
                l10n: l10n,
                passedLabel: _passedLabel,
              ),
        ],
      ),
    );
  }

  String _passedLabel(Map<String, dynamic> attempt, AppLocalizations l10n) {
    final passed = attempt['passed'] ?? attempt['is_passed'];
    if (passed == true) return l10n.passed;
    if (passed == false) return l10n.failed;
    return '';
  }
}

class _AssessmentResultCard extends StatelessWidget {
  const _AssessmentResultCard({
    required this.assessment,
    required this.l10n,
    required this.passedLabel,
  });

  final Map<String, dynamic> assessment;
  final AppLocalizations l10n;
  final String Function(Map<String, dynamic>, AppLocalizations) passedLabel;

  @override
  Widget build(BuildContext context) {
    final isPre = assessment['type']?.toString() == 'pre';
    final typeLabel = isPre ? l10n.preAssessment : l10n.postAssessment;
    final title =
        assessment['title']?.toString() ??
        (isPre ? l10n.preAssessment : l10n.postAssessment);
    final attempts = (assessment['attempts'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    return InstSoftCard(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: BatColors.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.fact_check_outlined,
                  color: BatColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: BatColors.heading,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: isPre
                            ? BatColors.accentSoft
                            : BatColors.primarySoft,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        typeLabel,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isPre
                              ? BatColors.accentHover
                              : BatColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '${attempts.length}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: BatColors.muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (attempts.isEmpty)
            Text(
              l10n.noAssessmentResults,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
            )
          else
            for (var i = 0; i < attempts.length; i++) ...[
              if (i > 0)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1, color: Color(0xFFE6E8EC)),
                ),
              _AttemptRow(
                attempt: attempts[i],
                l10n: l10n,
                resultLabel: passedLabel(attempts[i], l10n),
              ),
            ],
        ],
      ),
    );
  }
}

class _AttemptRow extends StatelessWidget {
  const _AttemptRow({
    required this.attempt,
    required this.l10n,
    required this.resultLabel,
  });

  final Map<String, dynamic> attempt;
  final AppLocalizations l10n;
  final String resultLabel;

  @override
  Widget build(BuildContext context) {
    final name =
        attempt['student_name']?.toString() ??
        (attempt['student'] is Map
            ? (attempt['student'] as Map)['full_name']?.toString()
            : null) ??
        '—';
    final score = attempt['score']?.toString() ?? '—';
    final initial = name.isNotEmpty ? name.characters.first : '?';
    final passed = attempt['passed'] ?? attempt['is_passed'];

    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: BatColors.primarySoft,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Center(
            child: Text(
              initial,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: BatColors.primary,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: BatColors.heading,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${l10n.score}: $score',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
              ),
            ],
          ),
        ),
        if (resultLabel.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: passed == true
                  ? BatColors.success.withValues(alpha: 0.12)
                  : const Color(0xFFEEF0F3),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              resultLabel,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: passed == true
                    ? BatColors.successText
                    : const Color(0xFF8B93A0),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}
