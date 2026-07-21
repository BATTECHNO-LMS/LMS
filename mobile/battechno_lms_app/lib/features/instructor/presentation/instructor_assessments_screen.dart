import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/localization/l10n/app_localizations.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/widgets/bat_widgets.dart';
import '../data/instructor_repository.dart';

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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.assessmentResults)),
      body: _loading
          ? const Padding(
              padding: EdgeInsets.all(16),
              child: LoadingSkeleton(lines: 4),
            )
          : _error != null
          ? RetryView(
              title: l10n.networkErrorTitle,
              message: _error == 'forbidden'
                  ? l10n.forbiddenAccess
                  : l10n.networkErrorBody,
              onRetry: _load,
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_assessments.isEmpty)
                    EmptyState(title: l10n.noAssessmentResults, subtitle: '')
                  else
                    for (final assessment in _assessments) ...[
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                assessment['title']?.toString() ??
                                    (assessment['type']?.toString() == 'pre'
                                        ? l10n.preAssessment
                                        : l10n.postAssessment),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                assessment['type']?.toString() == 'pre'
                                    ? l10n.preAssessment
                                    : l10n.postAssessment,
                              ),
                              const SizedBox(height: 8),
                              ..._attemptTiles(assessment, l10n),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                ],
              ),
            ),
    );
  }

  List<Widget> _attemptTiles(
    Map<String, dynamic> assessment,
    AppLocalizations l10n,
  ) {
    final attempts = (assessment['attempts'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
    if (attempts.isEmpty) {
      return [Text(l10n.noAssessmentResults)];
    }
    return [
      for (final attempt in attempts)
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            attempt['student_name']?.toString() ??
                (attempt['student'] is Map
                    ? (attempt['student'] as Map)['full_name']?.toString()
                    : null) ??
                '—',
          ),
          subtitle: Text(
            '${l10n.score}: ${attempt['score'] ?? '—'}'
            '${_passedLabel(attempt, l10n)}',
          ),
        ),
    ];
  }

  String _passedLabel(Map<String, dynamic> attempt, AppLocalizations l10n) {
    final passed = attempt['passed'] ?? attempt['is_passed'];
    if (passed == true) return ' · ${l10n.passed}';
    if (passed == false) return ' · ${l10n.failed}';
    return '';
  }
}
